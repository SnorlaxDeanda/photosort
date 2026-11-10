/**
 * Duplicate detection — two passes:
 *
 * Pass 1 – Exact content duplicates
 *   Group by (size → MD5 hash).  Cost: O(n) hash lookups.
 *
 * Pass 2 – Visual near-duplicates (photos only)
 *   Uses Locality Sensitive Hashing (LSH) instead of O(n²) all-pairs
 *   comparison.  A 16-hex-char perceptual hash is split into 4 bands of
 *   4 chars each.  Two photos that share ANY band are guaranteed to be
 *   within ~16 bits of Hamming distance; we then verify the exact distance.
 *
 *   Expected cost: O(n) inserts + O(k) per bucket where k << n.
 *   For 100 000 photos this reduces ~5 billion comparisons to a few million.
 */

import crypto from 'crypto'
import { MediaFile, DuplicateGroup } from '../shared/types'
import { hammingDistance } from './qualityAnalyzer'
import { md5File } from './fileScanner'

// ── LSH parameters ────────────────────────────────────────────────────────
// 16-hex-char hash → split into BANDS bands of BAND_WIDTH chars each.
// A wider band = stricter similarity threshold (fewer false positives).
const BANDS = 4
const BAND_WIDTH = 4  // 16 hex chars / 4 bands = 4 chars each

/** Build LSH band keys for a 16-char hex perceptual hash */
function lshBands(phash: string): string[] {
  const bands: string[] = []
  for (let b = 0; b < BANDS; b++) {
    const start = b * BAND_WIDTH
    bands.push(`${b}:${phash.slice(start, start + BAND_WIDTH)}`)
  }
  return bands
}

export async function detectDuplicates(
  files: MediaFile[],
  similarityThreshold = 8,
  onProgress?: (current: number, total: number) => void
): Promise<DuplicateGroup[]> {
  const groups: DuplicateGroup[] = []
  const usedIds = new Set<string>()

  // ── Pass 1: exact content duplicates ─────────────────────────────────
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
      let hash = f.hash ?? hashCache.get(f.path)
      if (!hash) {
        try {
          hash = await md5File(f.path)
          hashCache.set(f.path, hash)
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

  // ── Pass 2: LSH-based visual near-duplicates ─────────────────────────
  const photoFiles = files.filter(
    (f) => f.type === 'photo' && f.phash?.length === 16 && !usedIds.has(f.id)
  )

  // Build inverted index: band_key → [file, ...]
  const buckets = new Map<string, MediaFile[]>()
  for (const f of photoFiles) {
    for (const key of lshBands(f.phash!)) {
      const bucket = buckets.get(key) ?? []
      bucket.push(f)
      buckets.set(key, bucket)
    }
  }

  // Collect candidate pairs from shared buckets (deduplicated)
  const candidatePairs = new Set<string>()
  const pairList: [MediaFile, MediaFile][] = []
  for (const bucket of buckets.values()) {
    for (let i = 0; i < bucket.length; i++) {
      for (let j = i + 1; j < bucket.length; j++) {
        const key = bucket[i].id < bucket[j].id
          ? `${bucket[i].id}|${bucket[j].id}`
          : `${bucket[j].id}|${bucket[i].id}`
        if (!candidatePairs.has(key)) {
          candidatePairs.add(key)
          pairList.push([bucket[i], bucket[j]])
        }
      }
    }
  }

  // Verify exact Hamming distance for each candidate pair
  // Union-Find to group transitive near-duplicates
  const parent = new Map<string, string>()
  const find = (id: string): string => {
    if (!parent.has(id)) parent.set(id, id)
    const p = parent.get(id)!
    if (p !== id) { parent.set(id, find(p)); return parent.get(id)! }
    return id
  }
  const union = (a: string, b: string): void => {
    parent.set(find(a), find(b))
  }

  for (const [a, b] of pairList) {
    if (usedIds.has(a.id) || usedIds.has(b.id)) continue
    const dist = hammingDistance(a.phash!, b.phash!)
    if (dist <= similarityThreshold) {
      union(a.id, b.id)
    }
  }

  // Collect Union-Find groups into DuplicateGroup objects
  const ufGroups = new Map<string, MediaFile[]>()
  for (const f of photoFiles) {
    if (usedIds.has(f.id)) continue
    if (!parent.has(f.id)) continue  // no matches
    const root = find(f.id)
    const g = ufGroups.get(root) ?? []
    g.push(f)
    ufGroups.set(root, g)
  }

  for (const [, group] of ufGroups) {
    if (group.length < 2) continue
    // Compute worst-case similarity within the group
    let maxDist = 0
    const best = pickBestFile(group)
    for (const f of group) {
      if (f.id === best.id) continue
      const d = hammingDistance(best.phash!, f.phash!)
      if (d > maxDist) maxDist = d
    }
    const similarity = 1 - maxDist / 64
    groups.push({
      id: crypto.randomUUID(),
      kind: 'visual',
      similarity,
      files: group,
      keepId: best.id
    })
    group.forEach((f) => usedIds.add(f.id))
  }

  return groups
}

/** Pick the highest-quality file from a group */
export function pickBestFile(files: MediaFile[]): MediaFile {
  return files.reduce((best, f) => {
    if (f.formatRank > best.formatRank) return f
    if (f.formatRank === best.formatRank && f.qualityScore > best.qualityScore) return f
    return best
  })
}
