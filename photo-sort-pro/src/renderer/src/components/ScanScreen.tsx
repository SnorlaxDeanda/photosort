import React, { useEffect, useRef, useState } from 'react'
import { ScanResult, ScanProgress } from '../../../shared/types'

interface Props {
  sourceDir: string
  onDone: (result: ScanResult) => void
  onBack: () => void
}

const PHASE_LABELS: Record<ScanProgress['phase'], string> = {
  scanning:  'Discovering files…',
  hashing:   'Reading metadata & computing hashes…',
  comparing: 'Detecting duplicates…',
  done:      'Complete!'
}

export default function ScanScreen({ sourceDir, onDone, onBack }: Props): React.ReactElement {
  const [progress, setProgress] = useState<ScanProgress>({
    phase: 'scanning', current: 0, total: 0, currentFile: ''
  })
  const [error, setError] = useState('')
  const [done, setDone] = useState(false)
  const [result, setResult] = useState<ScanResult | null>(null)
  const startedRef = useRef(false)

  useEffect(() => {
    if (startedRef.current) return
    startedRef.current = true

    const unsub = window.api.onScanProgress((p) => setProgress(p as ScanProgress))

    window.api.startScan(sourceDir, 8)
      .then((r) => {
        const sr = r as ScanResult
        setResult(sr)
        setDone(true)
        setProgress({ phase: 'done', current: sr.files.length, total: sr.files.length, currentFile: '' })
      })
      .catch((err: Error) => {
        setError(String(err))
      })

    return () => unsub()
  }, [sourceDir])

  const pct = progress.total > 0
    ? Math.round((progress.current / progress.total) * 100)
    : 0

  return (
    <div className="screen">
      <div className="screen-header">
        <h2 className="screen-title">Scanning Your Library</h2>
        <p className="screen-subtitle">{sourceDir}</p>
      </div>

      <div className="card scan-card">
        <div className="scan-phase">{PHASE_LABELS[progress.phase]}</div>

        <div className="progress-bar" style={{ marginTop: 12 }}>
          <div
            className="progress-bar-fill"
            style={{ width: `${progress.phase === 'done' ? 100 : pct}%` }}
          />
        </div>

        <div className="scan-meta">
          <span>{progress.phase === 'done' ? '100%' : `${pct}%`}</span>
          {progress.total > 0 && (
            <span>{progress.current.toLocaleString()} / {progress.total.toLocaleString()} files</span>
          )}
        </div>

        {progress.currentFile && (
          <div className="scan-current-file">{progress.currentFile}</div>
        )}

        {/* Cache + concurrency badges */}
        {(progress.cacheHits !== undefined || progress.concurrency !== undefined) && (
          <div className="scan-badges">
            {progress.concurrency !== undefined && (
              <span className="scan-badge">⚡ {progress.concurrency} threads</span>
            )}
            {(progress.cacheHits ?? 0) > 0 && (
              <span className="scan-badge cache">{progress.cacheHits} cached (instant)</span>
            )}
          </div>
        )}
      </div>

      {done && result && (
        <div className="stat-grid">
          <StatChip value={result.files.length} label="Total files" color="accent" />
          <StatChip value={result.photoCount} label="Photos" color="info" />
          <StatChip value={result.videoCount} label="Videos" color="success" />
          <StatChip value={result.duplicates.length} label="Duplicate groups" color="warning" />
          <StatChip value={fmtBytes(result.totalSize)} label="Total size" color="muted" />
          <StatChip
            value={fmtBytes(
              result.duplicates.flatMap((g) =>
                g.files.filter((f) => f.id !== g.keepId)
              ).reduce((s, f) => s + f.size, 0)
            )}
            label="Reclaimable space"
            color="danger"
          />
        </div>
      )}

      {error && (
        <div className="error-banner" style={{ marginTop: 8 }}>
          Scan failed: {error}
        </div>
      )}

      <div className="action-bar">
        <button className="btn btn-secondary action-bar-left" onClick={onBack} disabled={!done && !error}>
          ← Back
        </button>
        {done && result && (
          <button className="btn btn-primary" onClick={() => onDone(result)}>
            Review Duplicates →
          </button>
        )}
      </div>

      <style>{STYLES}</style>
    </div>
  )
}

function StatChip({
  value,
  label,
  color
}: {
  value: string | number
  label: string
  color: string
}): React.ReactElement {
  return (
    <div className={`stat-chip stat-chip-${color}`}>
      <span className="stat-value">{value}</span>
      <span className="stat-label">{label}</span>
    </div>
  )
}

function fmtBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 ** 2) return `${(bytes / 1024).toFixed(1)} KB`
  if (bytes < 1024 ** 3) return `${(bytes / 1024 ** 2).toFixed(1)} MB`
  return `${(bytes / 1024 ** 3).toFixed(2)} GB`
}

const STYLES = `
.scan-card { display: flex; flex-direction: column; gap: 8px; }
.scan-phase { font-size: 15px; font-weight: 600; color: var(--text-primary); }
.scan-meta { display: flex; justify-content: space-between; font-size: 12px; color: var(--text-secondary); margin-top: 4px; }
.scan-current-file { font-size: 11px; font-family: var(--font-mono); color: var(--text-muted); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; margin-top: 4px; }
.scan-badges { display: flex; gap: 8px; flex-wrap: wrap; margin-top: 8px; }
.scan-badge { font-size: 11px; font-weight: 600; padding: 3px 8px; border-radius: 100px; background: var(--bg-elevated); color: var(--text-secondary); border: 1px solid var(--border); }
.scan-badge.cache { color: var(--success); border-color: rgba(74,222,128,0.3); background: rgba(74,222,128,0.08); }

.stat-chip-accent  { border-color: rgba(124,106,255,0.3); }
.stat-chip-info    { border-color: rgba(96,165,250,0.3); }
.stat-chip-info .stat-value { color: var(--info); }
.stat-chip-success { border-color: rgba(74,222,128,0.3); }
.stat-chip-success .stat-value { color: var(--success); }
.stat-chip-warning { border-color: rgba(250,204,21,0.3); }
.stat-chip-warning .stat-value { color: var(--warning); }
.stat-chip-danger  { border-color: rgba(248,113,113,0.3); }
.stat-chip-danger .stat-value { color: var(--danger); }
.stat-chip-muted .stat-value { color: var(--text-secondary); }
.error-banner { background: rgba(248,113,113,0.12); border: 1px solid rgba(248,113,113,0.3); border-radius: var(--radius-md); padding: 12px 16px; color: var(--danger); font-size: 13px; }
`
