import fs from 'fs'
import path from 'path'
import crypto from 'crypto'
import os from 'os'
import { Worker } from 'worker_threads'
import { MediaFile, MediaType, ScanProgress } from '../shared/types'
import { analyzeImage, analyzeVideo } from './qualityAnalyzer'
import { getCached, putCached } from './scanCache'

const PHOTO_EXTS = new Set([
  '.jpg', '.jpeg', '.png', '.gif', '.bmp', '.tiff', '.tif',
  '.webp', '.heic', '.heif', '.avif', '.raw', '.cr2', '.cr3',
  '.nef', '.orf', '.arw', '.dng', '.rw2', '.pef', '.srw'
])

const VIDEO_EXTS = new Set([
  '.mp4', '.mov', '.avi', '.mkv', '.wmv', '.flv', '.webm',
  '.m4v', '.3gp', '.mts', '.m2ts', '.ts', '.mpg', '.mpeg', '.vob'
])

/** Rank a file format — higher is better quality */
export function formatRank(ext: string): number {
  const e = ext.toLowerCase()
  const ranks: Record<string, number> = {
    '.raw': 100, '.cr2': 100, '.cr3': 100, '.nef': 100, '.orf': 100,
    '.arw': 100, '.dng': 100, '.rw2': 100, '.pef': 100, '.srw': 100,
    '.tiff': 90, '.tif': 90,
    '.png': 80,
    '.heic': 75, '.heif': 75, '.avif': 75,
    '.jpg': 70, '.jpeg': 70,
    '.webp': 65,
    '.bmp': 60,
    '.gif': 40,
    '.mp4': 80, '.mov': 80, '.m4v': 75,
    '.mkv': 78, '.wmv': 60, '.avi': 60,
    '.webm': 65, '.flv': 50,
    '.mpg': 55, '.mpeg': 55,
    '.3gp': 40, '.mts': 70, '.m2ts': 70
  }
  return ranks[e] ?? 50
}

export function getMediaType(ext: string): MediaType {
  const e = ext.toLowerCase()
  if (PHOTO_EXTS.has(e)) return 'photo'
  if (VIDEO_EXTS.has(e)) return 'video'
  return 'unknown'
}

function walkDir(dir: string, results: string[]): void {
  let entries: fs.Dirent[]
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true })
  } catch {
    return
  }
  for (const entry of entries) {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      walkDir(full, results)
    } else if (entry.isFile()) {
      const ext = path.extname(entry.name).toLowerCase()
      if (PHOTO_EXTS.has(ext) || VIDEO_EXTS.has(ext)) {
        results.push(full)
      }
    }
  }
}

export async function md5File(filePath: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const hash = crypto.createHash('md5')
    const stream = fs.createReadStream(filePath)
    stream.on('data', (d) => hash.update(d))
    stream.on('end', () => resolve(hash.digest('hex')))
    stream.on('error', reject)
  })
}

/**
 * Process a single file: check cache first, else run full analysis.
 * Returns the populated MediaFile.
 */
async function processFile(filePath: string): Promise<MediaFile | null> {
  const name = path.basename(filePath)
  const ext = path.extname(name).toLowerCase()
  const type = getMediaType(ext)
  const rank = formatRank(ext)

  let stat: fs.Stats
  try {
    stat = fs.statSync(filePath)
  } catch {
    return null
  }

  const mtime = Math.floor(stat.mtimeMs)
  const id = crypto.randomUUID()

  // ── Cache hit: skip all I/O ──────────────────────────────────────────
  const cached = getCached(filePath, stat.size, mtime)
  if (cached) {
    return { id, name, type, ext, ...cached }
  }

  // ── Cache miss: full analysis ────────────────────────────────────────
  const mediaFile: MediaFile = {
    id, path: filePath, name, size: stat.size, type, ext,
    qualityScore: 0, formatRank: rank
  }

  try {
    const hash = await md5File(filePath)
    mediaFile.hash = hash
  } catch { /* skip */ }

  try {
    if (type === 'photo') {
      const info = await analyzeImage(filePath)
      Object.assign(mediaFile, info)
    } else if (type === 'video') {
      const info = await analyzeVideo(filePath)
      Object.assign(mediaFile, info)
    }
  } catch { /* skip */ }

  const pixels = (mediaFile.width ?? 0) * (mediaFile.height ?? 0)
  mediaFile.qualityScore =
    (pixels / 1_000_000) * rank + (stat.size / 1_000_000) * 10

  putCached(mtime, mediaFile)
  return mediaFile
}

/**
 * Run `tasks` with at most `concurrency` running simultaneously.
 * Reports progress via `onItem` after each task completes.
 */
async function pool<T>(
  tasks: (() => Promise<T>)[],
  concurrency: number,
  onItem: (done: number, total: number) => void
): Promise<(T | null)[]> {
  const results: (T | null)[] = new Array(tasks.length).fill(null)
  let next = 0
  let done = 0
  const total = tasks.length

  await new Promise<void>((resolve) => {
    function runNext(): void {
      while (next < total) {
        const i = next++
        tasks[i]()
          .then((v) => { results[i] = v })
          .catch(() => { results[i] = null })
          .finally(() => {
            done++
            onItem(done, total)
            if (done === total) resolve()
            else runNext()
          })
      }
    }
    // Launch initial batch
    for (let i = 0; i < Math.min(concurrency, total); i++) runNext()
    if (total === 0) resolve()
  })

  return results
}

export async function scanDirectory(
  dir: string,
  onProgress: (p: ScanProgress) => void
): Promise<MediaFile[]> {
  onProgress({ phase: 'scanning', current: 0, total: 0, currentFile: dir })

  const paths: string[] = []
  walkDir(dir, paths)

  // Number of parallel file-analysis tasks.
  // Sharp is CPU-bound; cap at logical CPUs but leave one for the main thread.
  const concurrency = Math.max(1, Math.min(os.cpus().length - 1, 8))

  let cacheHits = 0
  const tasks = paths.map((filePath) => async () => {
    const name = path.basename(filePath)
    onProgress({ phase: 'hashing', current: 0, total: paths.length, currentFile: name, concurrency })

    let stat: fs.Stats
    try { stat = fs.statSync(filePath) } catch { return null }
    const mtime = Math.floor(stat.mtimeMs)

    // Quick cache check without I/O
    const cached = getCached(filePath, stat.size, mtime)
    if (cached) {
      cacheHits++
      const id = crypto.randomUUID()
      const name2 = path.basename(filePath)
      const ext = path.extname(name2).toLowerCase()
      return { id, name: name2, type: getMediaType(ext), ext, ...cached } as MediaFile
    }

    return processFile(filePath)
  })

  let processed = 0
  const rawResults = await pool(tasks, concurrency, (done, total) => {
    processed = done
    onProgress({
      phase: 'hashing',
      current: done,
      total,
      currentFile: path.basename(paths[Math.min(done, paths.length - 1)] ?? ''),
      cacheHits,
      concurrency
    })
  })

  const files = rawResults.filter((f): f is MediaFile => f !== null)
  onProgress({ phase: 'comparing', current: files.length, total: files.length, currentFile: '' })
  return files
}
