/**
 * SQLite-backed scan cache.
 *
 * Stores per-file metadata (hash, phash, dimensions, EXIF) keyed by
 * (path, size, mtime).  On re-scan, unchanged files are returned from
 * the cache instantly — no re-hashing, no re-reading EXIF.
 *
 * This makes repeated scans of large libraries nearly instant and allows
 * incremental scanning (add 500 new photos → only those 500 are processed).
 */

import Database from 'better-sqlite3'
import { app } from 'electron'
import path from 'path'
import fs from 'fs'
import { MediaFile } from '../shared/types'

let db: Database.Database | null = null

function getDb(): Database.Database {
  if (db) return db

  const dir = app.getPath('userData')
  fs.mkdirSync(dir, { recursive: true })
  const dbPath = path.join(dir, 'scan-cache.db')

  db = new Database(dbPath)
  db.pragma('journal_mode = WAL')
  db.pragma('synchronous = NORMAL')
  db.pragma('cache_size = -32000') // 32 MB page cache

  db.exec(`
    CREATE TABLE IF NOT EXISTS file_cache (
      path      TEXT NOT NULL,
      size      INTEGER NOT NULL,
      mtime     INTEGER NOT NULL,
      hash      TEXT,
      phash     TEXT,
      width     INTEGER,
      height    INTEGER,
      duration  REAL,
      date_taken TEXT,
      make      TEXT,
      model     TEXT,
      gps_lat   REAL,
      gps_lon   REAL,
      quality   REAL NOT NULL DEFAULT 0,
      format_rank INTEGER NOT NULL DEFAULT 50,
      PRIMARY KEY (path, size, mtime)
    );
    CREATE INDEX IF NOT EXISTS idx_hash  ON file_cache(hash)  WHERE hash IS NOT NULL;
    CREATE INDEX IF NOT EXISTS idx_phash ON file_cache(phash) WHERE phash IS NOT NULL;
  `)

  return db
}

interface CacheRow {
  path: string
  size: number
  mtime: number
  hash: string | null
  phash: string | null
  width: number | null
  height: number | null
  duration: number | null
  date_taken: string | null
  make: string | null
  model: string | null
  gps_lat: number | null
  gps_lon: number | null
  quality: number
  format_rank: number
}

const SELECT = `
  SELECT path, size, mtime, hash, phash, width, height, duration,
         date_taken, make, model, gps_lat, gps_lon, quality, format_rank
  FROM file_cache
  WHERE path = ? AND size = ? AND mtime = ?
`

export function getCached(
  filePath: string,
  size: number,
  mtime: number
): Omit<MediaFile, 'id' | 'name' | 'type' | 'ext'> | null {
  const row = getDb().prepare(SELECT).get(filePath, size, mtime) as CacheRow | undefined
  if (!row) return null
  return {
    path: row.path,
    size: row.size,
    hash: row.hash ?? undefined,
    phash: row.phash ?? undefined,
    width: row.width ?? undefined,
    height: row.height ?? undefined,
    durationSec: row.duration ?? undefined,
    dateTaken: row.date_taken ?? undefined,
    make: row.make ?? undefined,
    model: row.model ?? undefined,
    gps: row.gps_lat != null && row.gps_lon != null
      ? { lat: row.gps_lat, lon: row.gps_lon }
      : undefined,
    qualityScore: row.quality,
    formatRank: row.format_rank
  }
}

const UPSERT = `
  INSERT OR REPLACE INTO file_cache
    (path, size, mtime, hash, phash, width, height, duration,
     date_taken, make, model, gps_lat, gps_lon, quality, format_rank)
  VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
`

export function putCached(mtime: number, file: MediaFile): void {
  getDb().prepare(UPSERT).run(
    file.path, file.size, mtime,
    file.hash ?? null, file.phash ?? null,
    file.width ?? null, file.height ?? null,
    file.durationSec ?? null, file.dateTaken ?? null,
    file.make ?? null, file.model ?? null,
    file.gps?.lat ?? null, file.gps?.lon ?? null,
    file.qualityScore, file.formatRank
  )
}

/** Remove cache entries whose files no longer exist (housekeeping) */
export function pruneCache(existingPaths: Set<string>): number {
  const db = getDb()
  const all = db.prepare('SELECT DISTINCT path FROM file_cache').all() as { path: string }[]
  const toDelete = all.filter((r) => !existingPaths.has(r.path))
  if (toDelete.length === 0) return 0
  const del = db.prepare('DELETE FROM file_cache WHERE path = ?')
  const deleteMany = db.transaction((rows: { path: string }[]) => {
    for (const r of rows) del.run(r.path)
  })
  deleteMany(toDelete)
  return toDelete.length
}

export function closeCache(): void {
  db?.close()
  db = null
}
