import React, { useState } from 'react'

interface Props {
  onStart: (sourceDir: string, destDir: string) => void
}

declare global {
  interface Window {
    api: {
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

  async function browseSource(): Promise<void> {
    const dir = await window.api.openFolder()
    if (dir) setSourceDir(dir)
  }

  async function browseDest(): Promise<void> {
    const dir = await window.api.saveFolder()
    if (dir) setDestDir(dir)
  }

  function handleStart(): void {
    if (!sourceDir) {
      setError('Please select a source folder.')
      return
    }
    if (!destDir) {
      setError('Please select a destination folder.')
      return
    }
    if (sourceDir === destDir) {
      setError('Source and destination folders must be different.')
      return
    }
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
        <FolderRow
          label="Source Folder"
          description="Where your photos and videos are stored"
          value={sourceDir}
          placeholder="Click Browse to select…"
          onBrowse={browseSource}
        />
        <div className="folder-divider" />
        <FolderRow
          label="Destination Folder"
          description="Where organized files will be placed"
          value={destDir}
          placeholder="Click Browse to select…"
          onBrowse={browseDest}
        />
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

function FolderRow({
  label,
  description,
  value,
  placeholder,
  onBrowse
}: {
  label: string
  description: string
  value: string
  placeholder: string
  onBrowse: () => void
}): React.ReactElement {
  return (
    <div className="folder-row">
      <div className="folder-meta">
        <span className="folder-label">{label}</span>
        <span className="folder-desc">{description}</span>
      </div>
      <div className="folder-input-wrap">
        <span className="folder-path">{value || placeholder}</span>
        <button className="btn btn-secondary" onClick={onBrowse}>
          Browse…
        </button>
      </div>
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
.folder-divider { height: 1px; background: var(--border); margin: 0 -24px; }
.folder-row { display: flex; align-items: center; justify-content: space-between; gap: 16px; padding: 14px 0; }
.folder-meta { display: flex; flex-direction: column; gap: 3px; min-width: 0; }
.folder-label { font-size: 14px; font-weight: 600; color: var(--text-primary); }
.folder-desc { font-size: 12px; color: var(--text-secondary); }
.folder-input-wrap { display: flex; align-items: center; gap: 10px; min-width: 0; flex-shrink: 0; max-width: 60%; }
.folder-path { font-size: 12px; font-family: var(--font-mono); color: var(--text-muted); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; background: var(--bg-elevated); border: 1px solid var(--border); border-radius: var(--radius-sm); padding: 6px 10px; flex: 1; min-width: 0; }

.feature-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; width: 100%; text-align: left; }
.feature-card { display: flex; align-items: flex-start; gap: 12px; }
.feature-icon { font-size: 22px; flex-shrink: 0; margin-top: 2px; }
.feature-title { font-size: 13px; font-weight: 600; color: var(--text-primary); margin-bottom: 3px; }
.feature-desc { font-size: 12px; color: var(--text-secondary); line-height: 1.4; }

.error-banner { background: rgba(248,113,113,0.12); border: 1px solid rgba(248,113,113,0.3); border-radius: var(--radius-md); padding: 12px 16px; color: var(--danger); font-size: 13px; width: 100%; text-align: left; }
`
