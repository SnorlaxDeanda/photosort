export type MediaType = 'photo' | 'video' | 'unknown'

export interface SuggestedFolder {
  label: string
  path: string
  icon: string
  note?: string
}

export interface MediaFile {
  id: string
  path: string
  name: string
  size: number
  type: MediaType
  ext: string
  hash?: string
  phash?: string
  width?: number
  height?: number
  durationSec?: number
  dateTaken?: string
  make?: string
  model?: string
  gps?: { lat: number; lon: number }
  qualityScore: number
  formatRank: number
}

export interface DuplicateGroup {
  id: string
  kind: 'exact' | 'visual'
  similarity: number
  files: MediaFile[]
  keepId: string
}

export interface ScanProgress {
  phase: 'scanning' | 'hashing' | 'comparing' | 'done'
  current: number
  total: number
  currentFile: string
  cacheHits?: number
  concurrency?: number
}

export interface OrganizeOptions {
  sourceDir: string
  destDir: string
  structure: 'year/month' | 'year/month/day' | 'year' | 'flat'
  separateVideos: boolean
  copyInsteadOfMove: boolean
  handleDuplicates: 'keep-best' | 'skip' | 'keep-all'
  similarityThreshold: number
}

export interface OrganizeResult {
  moved: number
  duplicatesRemoved: number
  spaceSavedBytes: number
  errors: string[]
  skipped: number
}

export interface ScanResult {
  files: MediaFile[]
  duplicates: DuplicateGroup[]
  totalSize: number
  photoCount: number
  videoCount: number
}
