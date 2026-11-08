import fs from 'fs'
import path from 'path'
import crypto from 'crypto'
import { MediaFile, MediaType, ScanProgress } from '../shared/types'
import { analyzeImage, analyzeVideo } from './qualityAnalyzer'

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

export async function scanDirectory(
  dir: string,
  onProgress: (p: ScanProgress) => void
): Promise<MediaFile[]> {
  onProgress({ phase: 'scanning', current: 0, total: 0, currentFile: dir })

  const paths: string[] = []
  walkDir(dir, paths)

  const files: MediaFile[] = []

  for (let i = 0; i < paths.length; i++) {
    const filePath = paths[i]
    const name = path.basename(filePath)
    const ext = path.extname(name).toLowerCase()
    const type = getMediaType(ext)
    const rank = formatRank(ext)

    onProgress({
      phase: 'hashing',
      current: i + 1,
      total: paths.length,
      currentFile: name
    })

    let stat: fs.Stats
    try {
      stat = fs.statSync(filePath)
    } catch {
      continue
    }

    const id = crypto.randomUUID()
    const mediaFile: MediaFile = {
      id,
      path: filePath,
      name,
      size: stat.size,
      type,
      ext,
      qualityScore: 0,
      formatRank: rank
    }

    try {
      if (type === 'photo') {
        const info = await analyzeImage(filePath)
        Object.assign(mediaFile, info)
      } else if (type === 'video') {
        const info = await analyzeVideo(filePath)
        Object.assign(mediaFile, info)
      }
    } catch {
      // analysis failed — keep basic metadata
    }

    // Compute quality score: resolution × format rank / compression ratio
    const pixels = (mediaFile.width ?? 0) * (mediaFile.height ?? 0)
    const megapixels = pixels / 1_000_000
    mediaFile.qualityScore =
      megapixels * rank + (mediaFile.size / 1_000_000) * 10

    files.push(mediaFile)
  }

  onProgress({ phase: 'comparing', current: paths.length, total: paths.length, currentFile: '' })
  return files
}
