import React, { useState } from 'react'
import { ScanResult, DuplicateGroup, MediaFile } from '../../../shared/types'

interface Props {
  scanResult: ScanResult
  duplicateGroups: DuplicateGroup[]
  onGroupsChange: (groups: DuplicateGroup[]) => void
  onNext: () => void
  onBack: () => void
}

export default function DuplicatesScreen({
  scanResult,
  duplicateGroups,
  onGroupsChange,
  onNext,
  onBack
}: Props): React.ReactElement {
  const [activeGroupIdx, setActiveGroupIdx] = useState(0)
  const [filter, setFilter] = useState<'all' | 'exact' | 'visual'>('all')

  const filtered = duplicateGroups.filter(
    (g) => filter === 'all' || g.kind === filter
  )

  const activeGroup = filtered[activeGroupIdx] ?? null

  function setKeep(groupId: string, fileId: string): void {
    onGroupsChange(
      duplicateGroups.map((g) =>
        g.id === groupId ? { ...g, keepId: fileId } : g
      )
    )
  }

  function removeGroup(groupId: string): void {
    const updated = duplicateGroups.filter((g) => g.id !== groupId)
    onGroupsChange(updated)
    setActiveGroupIdx((i) => Math.min(i, filtered.length - 2))
  }

  const duplicateCount = duplicateGroups.reduce(
    (s, g) => s + g.files.length - 1,
    0
  )
  const reclaimable = duplicateGroups.reduce(
    (s, g) =>
      s +
      g.files
        .filter((f) => f.id !== g.keepId)
        .reduce((a, f) => a + f.size, 0),
    0
  )

  if (duplicateGroups.length === 0) {
    return (
      <div className="screen">
        <div className="screen-header">
          <h2 className="screen-title">No Duplicates Found 🎉</h2>
          <p className="screen-subtitle">
            Your library has no duplicate or visually similar files. Ready to organize!
          </p>
        </div>
        <div className="action-bar">
          <button className="btn btn-secondary action-bar-left" onClick={onBack}>← Back</button>
          <button className="btn btn-primary" onClick={onNext}>Continue to Organize →</button>
        </div>
      </div>
    )
  }

  return (
    <div className="screen dup-screen">
      <div className="screen-header">
        <h2 className="screen-title">Review Duplicates</h2>
        <p className="screen-subtitle">
          Found <strong>{duplicateGroups.length}</strong> duplicate groups —{' '}
          <strong>{duplicateCount}</strong> extra files taking{' '}
          <strong>{fmtBytes(reclaimable)}</strong> of space.
        </p>
      </div>

      <div className="dup-layout">
        {/* ── Sidebar ── */}
        <aside className="dup-sidebar">
          <div className="dup-filter-bar">
            {(['all', 'exact', 'visual'] as const).map((k) => (
              <button
                key={k}
                className={`filter-btn ${filter === k ? 'active' : ''}`}
                onClick={() => { setFilter(k); setActiveGroupIdx(0) }}
              >
                {k === 'all' ? 'All' : k === 'exact' ? 'Exact' : 'Similar'}
              </button>
            ))}
          </div>
          <div className="dup-list">
            {filtered.map((group, i) => (
              <button
                key={group.id}
                className={`dup-list-item ${i === activeGroupIdx ? 'active' : ''}`}
                onClick={() => setActiveGroupIdx(i)}
              >
                <span className={`kind-badge kind-${group.kind}`}>
                  {group.kind === 'exact' ? 'Exact' : `~${Math.round(group.similarity * 100)}%`}
                </span>
                <span className="dup-list-count">{group.files.length} files</span>
                <span className="dup-list-name" title={group.files[0].name}>
                  {group.files[0].name}
                </span>
              </button>
            ))}
          </div>
        </aside>

        {/* ── Detail ── */}
        <div className="dup-detail">
          {activeGroup ? (
            <>
              <div className="dup-detail-header">
                <span className={`kind-badge kind-${activeGroup.kind}`}>
                  {activeGroup.kind === 'exact' ? 'Exact Duplicate' : `Visual Match — ${Math.round(activeGroup.similarity * 100)}% similar`}
                </span>
                <button
                  className="btn btn-ghost"
                  onClick={() => removeGroup(activeGroup.id)}
                  title="Skip this group (keep all)"
                >
                  Skip group
                </button>
              </div>

              <div className="dup-cards">
                {activeGroup.files.map((file) => (
                  <FileCard
                    key={file.id}
                    file={file}
                    isKeep={file.id === activeGroup.keepId}
                    onKeep={() => setKeep(activeGroup.id, file.id)}
                  />
                ))}
              </div>
            </>
          ) : (
            <div className="dup-empty">Select a group from the list</div>
          )}
        </div>
      </div>

      <div className="action-bar">
        <button className="btn btn-secondary action-bar-left" onClick={onBack}>← Back</button>
        <span className="action-info">{duplicateGroups.length} groups to resolve</span>
        <button className="btn btn-primary" onClick={onNext}>
          Continue to Organize →
        </button>
      </div>

      <style>{STYLES}</style>
    </div>
  )
}

function FileCard({
  file,
  isKeep,
  onKeep
}: {
  file: MediaFile
  isKeep: boolean
  onKeep: () => void
}): React.ReactElement {
  return (
    <div className={`file-card ${isKeep ? 'keep' : 'delete'}`}>
      <div className="file-thumb">
        {file.type === 'photo' ? '🖼' : '🎬'}
      </div>
      <div className="file-info">
        <div className="file-name" title={file.path}>{file.name}</div>
        <div className="file-meta">
          {file.width && file.height
            ? <span>{file.width}×{file.height}</span>
            : null}
          <span>{fmtBytes(file.size)}</span>
          <span className="ext-badge">{file.ext.replace('.', '').toUpperCase()}</span>
          {file.dateTaken && (
            <span>{new Date(file.dateTaken).toLocaleDateString()}</span>
          )}
        </div>
        {file.make && (
          <div className="file-camera">{file.make} {file.model}</div>
        )}
        <div className="quality-bar">
          <div
            className="quality-fill"
            style={{ width: `${Math.min(100, (file.qualityScore / 200) * 100)}%` }}
          />
          <span className="quality-label">Quality: {Math.round(file.qualityScore)}</span>
        </div>
      </div>
      <div className="file-actions">
        <button
          className={`keep-btn ${isKeep ? 'active' : ''}`}
          onClick={onKeep}
        >
          {isKeep ? '✓ Keep' : 'Keep this'}
        </button>
        {!isKeep && <span className="delete-label">Will remove</span>}
      </div>
    </div>
  )
}

function fmtBytes(bytes: number): string {
  if (bytes < 1024 ** 2) return `${(bytes / 1024).toFixed(0)} KB`
  if (bytes < 1024 ** 3) return `${(bytes / 1024 ** 2).toFixed(1)} MB`
  return `${(bytes / 1024 ** 3).toFixed(2)} GB`
}

const STYLES = `
.dup-screen { padding-bottom: 0; overflow: hidden; }
.dup-layout { display: flex; gap: 16px; flex: 1; min-height: 0; overflow: hidden; }

/* Sidebar */
.dup-sidebar { width: 240px; flex-shrink: 0; display: flex; flex-direction: column; gap: 10px; background: var(--bg-surface); border: 1px solid var(--border); border-radius: var(--radius-lg); padding: 12px; overflow: hidden; }
.dup-filter-bar { display: flex; gap: 6px; }
.filter-btn { flex: 1; padding: 6px 0; border-radius: var(--radius-sm); font-size: 12px; font-weight: 600; background: var(--bg-elevated); color: var(--text-secondary); border: 1px solid var(--border); cursor: pointer; transition: all 0.15s; }
.filter-btn.active { background: var(--accent); color: #fff; border-color: var(--accent); }
.dup-list { flex: 1; overflow-y: auto; display: flex; flex-direction: column; gap: 4px; }
.dup-list-item { display: flex; flex-direction: column; gap: 4px; padding: 10px; border-radius: var(--radius-md); border: 1px solid transparent; background: transparent; text-align: left; cursor: pointer; transition: all 0.15s; }
.dup-list-item:hover { background: var(--bg-elevated); }
.dup-list-item.active { background: var(--bg-hover); border-color: var(--accent); }
.dup-list-count { font-size: 11px; color: var(--text-secondary); }
.dup-list-name { font-size: 12px; color: var(--text-primary); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }

.kind-badge { display: inline-block; padding: 2px 8px; border-radius: 100px; font-size: 11px; font-weight: 700; width: fit-content; }
.kind-exact  { background: rgba(96,165,250,0.15); color: var(--info); }
.kind-visual { background: rgba(250,204,21,0.15); color: var(--warning); }

/* Detail */
.dup-detail { flex: 1; display: flex; flex-direction: column; gap: 12px; min-width: 0; overflow: hidden; }
.dup-detail-header { display: flex; align-items: center; justify-content: space-between; }
.dup-empty { flex: 1; display: flex; align-items: center; justify-content: center; color: var(--text-muted); font-size: 14px; }

.dup-cards { display: flex; gap: 12px; flex-wrap: wrap; overflow-y: auto; flex: 1; align-content: flex-start; padding-bottom: 8px; }

/* File Card */
.file-card { width: 220px; background: var(--bg-surface); border: 2px solid var(--border); border-radius: var(--radius-lg); overflow: hidden; display: flex; flex-direction: column; transition: border-color 0.2s; flex-shrink: 0; }
.file-card.keep  { border-color: var(--success); }
.file-card.delete { opacity: 0.7; }
.file-thumb { height: 120px; background: var(--bg-elevated); display: flex; align-items: center; justify-content: center; font-size: 40px; }
.file-info { padding: 12px; display: flex; flex-direction: column; gap: 6px; flex: 1; }
.file-name { font-size: 12px; font-weight: 600; color: var(--text-primary); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.file-meta { display: flex; flex-wrap: wrap; gap: 6px; align-items: center; }
.file-meta span { font-size: 11px; color: var(--text-secondary); }
.ext-badge { background: var(--bg-elevated); border-radius: 4px; padding: 1px 5px; font-size: 10px; font-weight: 700; color: var(--text-primary); }
.file-camera { font-size: 11px; color: var(--text-muted); }
.quality-bar { position: relative; height: 4px; background: var(--bg-elevated); border-radius: 2px; margin-top: 4px; }
.quality-fill { position: absolute; left: 0; top: 0; height: 100%; background: var(--accent); border-radius: 2px; }
.quality-label { position: absolute; right: 0; top: -14px; font-size: 10px; color: var(--text-muted); }
.file-actions { padding: 10px 12px; border-top: 1px solid var(--border); display: flex; align-items: center; justify-content: space-between; gap: 6px; }
.keep-btn { padding: 6px 12px; border-radius: var(--radius-sm); font-size: 12px; font-weight: 700; border: 1px solid var(--border); background: var(--bg-elevated); color: var(--text-secondary); cursor: pointer; transition: all 0.15s; }
.keep-btn.active { background: var(--success); color: #000; border-color: var(--success); }
.keep-btn:hover:not(.active) { background: var(--bg-hover); color: var(--text-primary); }
.delete-label { font-size: 11px; color: var(--danger); }

.action-info { font-size: 13px; color: var(--text-secondary); }
`
