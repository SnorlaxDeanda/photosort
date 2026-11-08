import React from 'react'
import { OrganizeResult } from '../../../shared/types'

interface Props {
  result: OrganizeResult
  onRestart: () => void
}

export default function ResultsScreen({ result, onRestart }: Props): React.ReactElement {
  const hasErrors = result.errors.length > 0

  return (
    <div className="screen results-screen">
      <div className="results-hero">
        <div className={`results-icon ${hasErrors ? 'partial' : 'success'}`}>
          {hasErrors ? '⚠' : '✓'}
        </div>
        <h2 className="results-title">
          {hasErrors ? 'Completed with Warnings' : 'All Done!'}
        </h2>
        <p className="results-subtitle">
          {hasErrors
            ? 'Most files were processed. Check warnings below.'
            : 'Your library has been sorted and cleaned up.'}
        </p>
      </div>

      <div className="stat-grid results-stats">
        <StatCard
          icon="📁"
          value={result.moved.toLocaleString()}
          label="Files organized"
          color="accent"
        />
        <StatCard
          icon="🗑"
          value={result.duplicatesRemoved.toLocaleString()}
          label="Duplicates removed"
          color="success"
        />
        <StatCard
          icon="💾"
          value={fmtBytes(result.spaceSavedBytes)}
          label="Space reclaimed"
          color="info"
        />
        <StatCard
          icon="⏭"
          value={result.skipped.toLocaleString()}
          label="Files skipped"
          color="muted"
        />
      </div>

      {hasErrors && (
        <div className="card errors-card">
          <div className="errors-title">⚠ Warnings ({result.errors.length})</div>
          <ul className="errors-list">
            {result.errors.map((e, i) => (
              <li key={i}>{e}</li>
            ))}
          </ul>
        </div>
      )}

      <div className="results-tips card">
        <div className="tips-title">What's next?</div>
        <div className="tips-grid">
          {TIPS.map((t) => (
            <div className="tip" key={t.title}>
              <span className="tip-icon">{t.icon}</span>
              <div>
                <div className="tip-title">{t.title}</div>
                <div className="tip-desc">{t.desc}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="action-bar">
        <button className="btn btn-primary btn-lg" onClick={onRestart}>
          ✦ Sort Another Folder
        </button>
      </div>

      <style>{STYLES}</style>
    </div>
  )
}

function StatCard({
  icon,
  value,
  label,
  color
}: {
  icon: string
  value: string | number
  label: string
  color: string
}): React.ReactElement {
  return (
    <div className={`stat-chip stat-card-${color}`}>
      <span className="stat-card-icon">{icon}</span>
      <span className="stat-value">{value}</span>
      <span className="stat-label">{label}</span>
    </div>
  )
}

function fmtBytes(bytes: number): string {
  if (bytes === 0) return '0 B'
  if (bytes < 1024 ** 2) return `${(bytes / 1024).toFixed(0)} KB`
  if (bytes < 1024 ** 3) return `${(bytes / 1024 ** 2).toFixed(1)} MB`
  return `${(bytes / 1024 ** 3).toFixed(2)} GB`
}

const TIPS = [
  {
    icon: '☁️',
    title: 'Back up to the cloud',
    desc: 'Upload your newly organized library to Google Photos, iCloud, or Amazon Photos.'
  },
  {
    icon: '🔒',
    title: 'Verify originals',
    desc: 'If you ran in copy mode, confirm everything looks right before removing the source.'
  },
  {
    icon: '📱',
    title: 'Import to a photo app',
    desc: 'Point Lightroom, Photos, or Capture One at the organized folder to re-import.'
  },
  {
    icon: '🔄',
    title: 'Run again anytime',
    desc: 'Run Photo Sort Pro again whenever you import new photos to keep your library tidy.'
  }
]

const STYLES = `
.results-screen { align-items: center; text-align: center; }

.results-hero { display: flex; flex-direction: column; align-items: center; gap: 10px; }
.results-icon { width: 72px; height: 72px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 36px; font-weight: 700; }
.results-icon.success { background: rgba(74,222,128,0.15); color: var(--success); border: 2px solid rgba(74,222,128,0.3); }
.results-icon.partial  { background: rgba(250,204,21,0.15); color: var(--warning); border: 2px solid rgba(250,204,21,0.3); }
.results-title { font-size: 28px; font-weight: 800; color: var(--text-primary); }
.results-subtitle { font-size: 14px; color: var(--text-secondary); }

.results-stats { width: 100%; }
.stat-card-accent .stat-value { color: var(--accent-light); }
.stat-card-success .stat-value { color: var(--success); }
.stat-card-info .stat-value { color: var(--info); }
.stat-card-muted .stat-value { color: var(--text-secondary); }
.stat-card-icon { font-size: 20px; margin-bottom: 2px; }

.errors-card { width: 100%; text-align: left; background: rgba(248,113,113,0.06); border-color: rgba(248,113,113,0.2); }
.errors-title { font-size: 14px; font-weight: 700; color: var(--warning); margin-bottom: 10px; }
.errors-list { list-style: none; display: flex; flex-direction: column; gap: 6px; max-height: 120px; overflow-y: auto; }
.errors-list li { font-size: 12px; font-family: var(--font-mono); color: var(--text-secondary); padding: 4px 0; border-bottom: 1px solid var(--border); }

.results-tips { width: 100%; text-align: left; }
.tips-title { font-size: 13px; font-weight: 700; color: var(--text-secondary); text-transform: uppercase; letter-spacing: 0.06em; margin-bottom: 14px; }
.tips-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 14px; }
.tip { display: flex; align-items: flex-start; gap: 10px; }
.tip-icon { font-size: 20px; flex-shrink: 0; }
.tip-title { font-size: 13px; font-weight: 600; color: var(--text-primary); margin-bottom: 3px; }
.tip-desc { font-size: 12px; color: var(--text-secondary); line-height: 1.4; }
`
