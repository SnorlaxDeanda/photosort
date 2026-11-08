import React, { useState, useEffect } from 'react'
import { SuggestedFolder } from '../../../shared/types'

interface Props {
  onStart: (sourceDir: string, destDir: string) => void
}

declare global {
  interface Window {
    api: {
      getSuggestedFolders: () => Promise<SuggestedFolder[]>
      openFolder: () => Promise<string | null>
      saveFolder: () => Promise<string | null>
      startScan: (dir: string, threshold: number) => Promise<unknown>
      startOrganize: (scan: unknown, opts: unknown) => Promise<unknown>
      onScanProgress: (cb: (p: unknown) => void) => () => void
      onOrganizeProgress: (cb: (p: unknown) => void) => () => void
    }
  }
}

export default function WelcomeScreen({ onStart }: Props): React.ReactElement {
  const [sourceDir, setSourceDir] = useState('')
  const [destDir, setDestDir] = useState('')
  const [error, setError] = useState('')
  const [suggestions, setSuggestions] = useState<SuggestedFolder[]>([])
  const [activeNote, setActiveNote] = useState<string | null>(null)

  useEffect(() => {
    window.api.getSuggestedFolders().then(setSuggestions).catch(() => {})
  }, [])

  async function browseSource(): Promise<void> {
    const dir = await window.api.openFolder()
    if (dir) { setSourceDir(dir); setActiveNote(null) }
  }

  async function browseDest(): Promise<void> {
    const dir = await window.api.saveFolder()
    if (dir) setDestDir(dir)
  }

  function pickSuggestion(s: SuggestedFolder): void {
    setSourceDir(s.path)
    setActiveNote(s.note ?? null)
    setError('')
  }

  function handleStart(): void {
    if (!sourceDir) { setError('Please select a source folder.'); return }
    if (!destDir)   { setError('Please select a destination folder.'); return }
    if (sourceDir === destDir) { setError('Source and destination must be different.'); return }
    setError('')
    onStart(sourceDir, destDir)
  }

  return (
    <div className="screen welcome-screen">
      <div className="welcome-hero">
        <div className="hero-icon">✦</div>
        <h1 className="hero-title">Photo Sort Pro</h1>
        <p className="hero-subtitle">
          Scan, deduplicate, and organize your photos & videos — automatically
          keeping the highest-quality copy of every duplicate.
        </p>
      </div>

      <div className="folder-setup card">
        {/* ── Source ── */}
        <div className="folder-section">
          <div className="folder-section-header">
            <div className="folder-meta">
              <span className="folder-label">Source Folder</span>
              <span className="folder-desc">Where your photos and videos live</span>
            </div>
            <button className="btn btn-secondary" onClick={browseSource}>
              Browse…
            </button>
          </div>

          {/* Quick-pick shortcuts */}
          {suggestions.length > 0 && (
            <div className="suggestions">
              {suggestions.map((s) => (
                <button
                  key={s.path}
                  className={`suggestion-chip ${sourceDir === s.path ? 'active' : ''}`}
                  onClick={() => pickSuggestion(s)}
                  title={s.path}
                >
                  <span className="sug-icon">{s.icon}</span>
                  <span className="sug-label">{s.label}</span>
                  {s.note && <span className="sug-note-icon" title={s.note}>ℹ</span>}
                </button>
              ))}
            </div>
          )}

          {/* Warning for Photos Library */}
          {activeNote && (
            <div className="note-banner">
              <span>ℹ️</span> <span>{activeNote}</span>
            </div>
          )}

          {/* Selected path display */}
          <div className="folder-path-display">
            {sourceDir
              ? <><span className="path-dot active" />  <span className="path-text">{sourceDir}</span></>
              : <span className="path-text muted">No folder selected — choose above or browse</span>
            }
          </div>
        </div>

        <div className="folder-divider" />

        {/* ── Destination ── */}
        <div className="folder-section">
          <div className="folder-section-header">
            <div className="folder-meta">
              <span className="folder-label">Destination Folder</span>
              <span className="folder-desc">Where organized files will be placed</span>
            </div>
            <button className="btn btn-secondary" onClick={browseDest}>
              Browse…
            </button>
          </div>
          <div className="folder-path-display">
            {destDir
              ? <><span className="path-dot active" /> <span className="path-text">{destDir}</span></>
              : <span className="path-text muted">No folder selected — click Browse</span>
            }
          </div>
        </div>
      </div>

      <div className="feature-grid">
        {FEATURES.map((f) => (
          <div className="feature-card card card-sm" key={f.title}>
            <span className="feature-icon">{f.icon}</span>
            <div>
              <div className="feature-title">{f.title}</div>
              <div className="feature-desc">{f.desc}</div>
            </div>
          </div>
        ))}
      </div>

      {error && <div className="error-banner">{error}</div>}

      <div className="action-bar">
        <button
          className="btn btn-primary btn-lg"
          onClick={handleStart}
          disabled={!sourceDir || !destDir}
        >
          Start Scanning →
        </button>
      </div>

      <style>{STYLES}</style>
    </div>
  )
}

const FEATURES = [
  {
    icon: '🔍',
    title: 'Deep Duplicate Detection',
    desc: 'Finds exact copies and visually similar images using perceptual hashing.'
  },
  {
    icon: '🏆',
    title: 'Quality-Aware',
    desc: 'Keeps the highest-resolution, least-compressed, best-format copy.'
  },
  {
    icon: '📅',
    title: 'Date-Based Sorting',
    desc: 'Reads EXIF metadata to sort into Year/Month/Day folders automatically.'
  },
  {
    icon: '🎬',
    title: 'Video Support',
    desc: 'Handles MP4, MOV, MKV, AVI and more alongside every photo format.'
  },
  {
    icon: '🗺️',
    title: 'GPS Metadata',
    desc: 'Reads GPS tags so you can see where each photo was taken.'
  },
  {
    icon: '🛡️',
    title: 'Safe by Default',
    desc: 'Review every change before committing. Copy instead of move if preferred.'
  }
]

const STYLES = `
.welcome-screen { align-items: center; text-align: center; max-width: 740px; margin: 0 auto; }

.welcome-hero { display: flex; flex-direction: column; align-items: center; gap: 12px; }
.hero-icon { font-size: 48px; line-height: 1; color: var(--accent); filter: drop-shadow(0 0 20px var(--accent)); }
.hero-title { font-size: 36px; font-weight: 800; background: linear-gradient(135deg, #fff 30%, var(--accent-light)); -webkit-background-clip: text; -webkit-text-fill-color: transparent; }
.hero-subtitle { font-size: 15px; color: var(--text-secondary); max-width: 520px; line-height: 1.6; }

.folder-setup { display: flex; flex-direction: column; gap: 0; width: 100%; text-align: left; }
.folder-section { display: flex; flex-direction: column; gap: 10px; padding: 16px 0; }
.folder-divider { height: 1px; background: var(--border); margin: 0 -24px; }
.folder-section-header { display: flex; align-items: center; justify-content: space-between; gap: 16px; }
.folder-meta { display: flex; flex-direction: column; gap: 3px; }
.folder-label { font-size: 14px; font-weight: 600; color: var(--text-primary); }
.folder-desc { font-size: 12px; color: var(--text-secondary); }

/* Quick-pick chips */
.suggestions { display: flex; flex-wrap: wrap; gap: 8px; }
.suggestion-chip { display: flex; align-items: center; gap: 6px; padding: 6px 12px; border-radius: 100px; border: 1px solid var(--border); background: var(--bg-elevated); font-size: 12px; font-weight: 500; color: var(--text-secondary); cursor: pointer; transition: all 0.15s; }
.suggestion-chip:hover { border-color: var(--accent); color: var(--text-primary); background: var(--bg-hover); }
.suggestion-chip.active { border-color: var(--accent); background: var(--accent-glow); color: var(--text-primary); }
.sug-icon { font-size: 14px; }
.sug-label { }
.sug-note-icon { font-size: 11px; color: var(--warning); margin-left: 2px; }

/* Note banner (Photos Library warning) */
.note-banner { display: flex; align-items: flex-start; gap: 8px; background: rgba(250,204,21,0.08); border: 1px solid rgba(250,204,21,0.25); border-radius: var(--radius-sm); padding: 10px 14px; font-size: 12px; color: var(--warning); line-height: 1.5; }

/* Path display */
.folder-path-display { display: flex; align-items: center; gap: 8px; background: var(--bg-elevated); border: 1px solid var(--border); border-radius: var(--radius-sm); padding: 8px 12px; min-height: 34px; }
.path-dot { width: 6px; height: 6px; border-radius: 50%; background: var(--text-muted); flex-shrink: 0; }
.path-dot.active { background: var(--success); }
.path-text { font-size: 12px; font-family: var(--font-mono); color: var(--text-muted); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.path-text:not(.muted) { color: var(--text-secondary); }

.feature-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; width: 100%; text-align: left; }
.feature-card { display: flex; align-items: flex-start; gap: 12px; }
.feature-icon { font-size: 22px; flex-shrink: 0; margin-top: 2px; }
.feature-title { font-size: 13px; font-weight: 600; color: var(--text-primary); margin-bottom: 3px; }
.feature-desc { font-size: 12px; color: var(--text-secondary); line-height: 1.4; }

.error-banner { background: rgba(248,113,113,0.12); border: 1px solid rgba(248,113,113,0.3); border-radius: var(--radius-md); padding: 12px 16px; color: var(--danger); font-size: 13px; width: 100%; text-align: left; }
`
