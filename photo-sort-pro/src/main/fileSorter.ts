import fs from 'fs'
import path from 'path'
import { MediaFile, DuplicateGroup, OrganizeOptions, OrganizeResult } from '../shared/types'
import { pickBestFile } from './duplicateDetector'

function ensureDir(dir: string): void {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true })
  }
}

function safeDestPath(destDir: string, filename: string): string {
  let dest = path.join(destDir, filename)
  if (!fs.existsSync(dest)) return dest
  const ext = path.extname(filename)
  const base = path.basename(filename, ext)
  let n = 1
  while (fs.existsSync(dest)) {
    dest = path.join(destDir, `${base}_${n}${ext}`)
    n++
  }
  return dest
}

function buildDestDir(baseDir: string, file: MediaFile, opts: OrganizeOptions): string {
  const date = file.dateTaken ? new Date(file.dateTaken) : null
  const year = date ? String(date.getFullYear()) : 'Unknown'
  const month = date ? String(date.getMonth() + 1).padStart(2, '0') : 'Unknown'
  const day = date ? String(date.getDate()).padStart(2, '0') : 'Unknown'

  let subDir: string
  switch (opts.structure) {
    case 'year':
      subDir = year
      break
    case 'year/month':
      subDir = path.join(year, month)
      break
    case 'year/month/day':
      subDir = path.join(year, month, day)
      break
    case 'flat':
    default:
      subDir = ''
  }

  if (opts.separateVideos && file.type === 'video') {
    subDir = subDir ? path.join('Videos', subDir) : 'Videos'
  } else if (opts.separateVideos && file.type === 'photo') {
    subDir = subDir ? path.join('Photos', subDir) : 'Photos'
  }

  return path.join(baseDir, subDir)
}

export async function organizeFiles(
  files: MediaFile[],
  duplicateGroups: DuplicateGroup[],
  opts: OrganizeOptions,
  onProgress?: (current: number, total: number, file: string) => void
): Promise<OrganizeResult> {
  const result: OrganizeResult = {
    moved: 0,
    duplicatesRemoved: 0,
    spaceSavedBytes: 0,
    errors: [],
    skipped: 0
  }

  // Determine which files to delete (duplicates to remove)
  const toDelete = new Set<string>()
  const duplicateMap = new Map<string, DuplicateGroup>()

  if (opts.handleDuplicates === 'keep-best') {
    for (const group of duplicateGroups) {
      duplicateMap.set(group.id, group)
      for (const f of group.files) {
        if (f.id !== group.keepId) {
          toDelete.add(f.id)
        }
      }
    }
  }

  const allFiles = opts.handleDuplicates === 'keep-all'
    ? files
    : files.filter((f) => !toDelete.has(f.id))

  for (let i = 0; i < allFiles.length; i++) {
    const file = allFiles[i]
    onProgress?.(i + 1, allFiles.length, file.name)

    const destDir = buildDestDir(opts.destDir, file, opts)
    ensureDir(destDir)
    const dest = safeDestPath(destDir, file.name)

    try {
      if (opts.copyInsteadOfMove) {
        fs.copyFileSync(file.path, dest)
      } else {
        fs.renameSync(file.path, dest)
      }
      result.moved++
    } catch (err) {
      result.errors.push(`Failed to move ${file.name}: ${String(err)}`)
      result.skipped++
    }
  }

  // Track space saved from removed duplicates
  for (const file of files) {
    if (toDelete.has(file.id)) {
      result.duplicatesRemoved++
      result.spaceSavedBytes += file.size
      // If we moved instead of copy, the duplicate source already went with it,
      // so we try to remove the original if it still exists
      if (!opts.copyInsteadOfMove) {
        try {
          if (fs.existsSync(file.path)) fs.unlinkSync(file.path)
        } catch {
          // ignore
        }
      }
    }
  }

  return result
}
