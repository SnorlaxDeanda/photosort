import crypto from 'crypto'
import fs from 'fs'
import { MediaFile, DuplicateGroup } from '../shared/types'
import { hammingDistance } from './qualityAnalyzer'
import { md5File } from './fileScanner'

/**
 * Group an array of MediaFile objects into duplicate groups.
 *
 * Pass 1 — exact duplicates: group by (size → MD5 hash).
 * Pass 2 — visual near-duplicates for photos with a perceptual hash:
 *   group remaining files where Hamming distance < threshold (default 8/64 bits).
 */
export async function detectDuplicates(
  files: MediaFile[],
  similarityThreshold = 8,
  onProgress?: (current: number, total: number) => void
): Promise<DuplicateGroup[]> {
  const groups: DuplicateGroup[] = []
  const usedIds = new Set<string>()

  // ── Pass 1: exact content duplicates ────────────────────────────────────
  // Group by size first (cheap filter)
  const bySize = new Map<number, MediaFile[]>()
  for (const f of files) {
    const arr = bySize.get(f.size) ?? []
    arr.push(f)
    bySize.set(f.size, arr)
  }

  let processed = 0
  const candidates = [...bySize.values()].filter((g) => g.length > 1)
  const hashCache = new Map<string, string>()

  for (const sizeGroup of candidates) {
    const byHash = new Map<string, MediaFile[]>()
    for (const f of sizeGroup) {
      onProgress?.(processed++, files.length)
      let hash = hashCache.get(f.path)
      if (!hash) {
        try {
          hash = await md5File(f.path)
          hashCache.set(f.path, hash)
          f.hash = hash
        } catch {
          continue
        }
      }
      const arr = byHash.get(hash) ?? []
      arr.push(f)
      byHash.set(hash, arr)
    }

    for (const [, hashGroup] of byHash) {
      if (hashGroup.length > 1) {
        const keepId = pickBestFile(hashGroup).id
        groups.push({
          id: crypto.randomUUID(),
          kind: 'exact',
          similarity: 1,
          files: hashGroup,
          keepId
        })
        hashGroup.forEach((f) => usedIds.add(f.id))
      }
    }
  }

  // ── Pass 2: perceptual (visual) near-duplicates for photos ───────────────
  const photoFiles = files.filter(
    (f) => f.type === 'photo' && f.phash && !usedIds.has(f.id)
  )

  const visited = new Set<string>()
  for (let i = 0; i < photoFiles.length; i++) {
    const a = photoFiles[i]
    if (visited.has(a.id)) continue
    const group: MediaFile[] = [a]

    for (let j = i + 1; j < photoFiles.length; j++) {
      const b = photoFiles[j]
      if (visited.has(b.id)) continue
      const dist = hammingDistance(a.phash!, b.phash!)
      if (dist <= similarityThreshold) {
        group.push(b)
        visited.add(b.id)
      }
    }

    if (group.length > 1) {
      visited.add(a.id)
      const maxDist = Math.max(
        ...group.slice(1).map((b) => hammingDistance(a.phash!, b.phash!))
      )
      const similarity = 1 - maxDist / 64
      const keepId = pickBestFile(group).id
      groups.push({
        id: crypto.randomUUID(),
        kind: 'visual',
        similarity,
        files: group,
        keepId
      })
      group.forEach((f) => usedIds.add(f.id))
    }
  }

  return groups
}

/** Pick the highest-quality file from a group */
export function pickBestFile(files: MediaFile[]): MediaFile {
  return files.reduce((best, f) => {
    // Prefer higher format rank first, then quality score
    if (f.formatRank > best.formatRank) return f
    if (f.formatRank === best.formatRank && f.qualityScore > best.qualityScore) return f
    return best
  })
}
