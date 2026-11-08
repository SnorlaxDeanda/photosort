import React, { useState } from 'react'
import { ScanResult, OrganizeOptions, OrganizeResult } from '../../../shared/types'

interface Props {
  sourceDir: string
  destDir: string
  scanResult: ScanResult
  onDone: (result: OrganizeResult) => void
  onBack: () => void
}

export default function OrganizeScreen({
  sourceDir,
  destDir,
  scanResult,
  onDone,
  onBack
}: Props): React.ReactElement {
  const [opts, setOpts] = useState<OrganizeOptions>({
    sourceDir,
    destDir,
    structure: 'year/month',
    separateVideos: true,
    copyInsteadOfMove: false,
    handleDuplicates: 'keep-best',
    similarityThreshold: 8
  })
  const [running, setRunning] = useState(false)
  const [progress, setProgress] = useState({ current: 0, total: 0, file: '' })
  const [error, setError] = useState('')

  const duplicatesToRemove = scanResult.duplicates.reduce(
    (s, g) => s + g.files.filter((f) => f.id !== g.keepId).length,
    0
  )
  const reclaimable = scanResult.duplicates.reduce(
    (s, g) =>
      s + g.files.filter((f) => f.id !== g.keepId).reduce((a, f) => a + f.size, 0),
    0
  )

  async function runOrganize(): Promise<void> {
    setRunning(true)
    setError('')
    const unsub = window.api.onOrganizeProgress((p) =>
      setProgress(p as { current: number; total: number; file: string })
    )
    try {
      const result = await window.api.startOrganize(scanResult, opts) as OrganizeResult
      onDone(result)
    } catch (err) {
      setError(String(err))
      setRunning(false)
    } finally {
      unsub()
    }
  }

  const pct = progress.total > 0
    ? Math.round((progress.current / progress.total) * 100)
    : 0

  return (
    <div className="screen">
      <div className="screen-header">
        <h2 className="screen-title">Organize Settings</h2>
        <p className="screen-subtitle">
          Configure how files will be sorted and where duplicates go.
        </p>
      </div>

      <div className="settings-grid">
        {/* Folder structure */}
        <SettingRow
          label="Folder Structure"
          description="How to arrange files in the destination folder"
        >
          <select
            className="styled-select"
            value={opts.structure}
            onChange={(e) => setOpts({ ...opts, structure: e.target.value as OrganizeOptions['structure'] })}
            disabled={running}
          >
            <option value="year/month">Year → Month  (2024/01)</option>
            <option value="year/month/day">Year → Month → Day  (2024/01/15)</option>
            <option value="year">Year only  (2024)</option>
            <option value="flat">Flat (no subfolders)</option>
          </select>
        </SettingRow>

        {/* Duplicate handling */}
        <SettingRow
          label="Duplicate Handling"
          description="What to do with duplicate files found in the scan"
        >
          <select
            className="styled-select"
            value={opts.handleDuplicates}
            onChange={(e) => setOpts({ ...opts, handleDuplicates: e.target.value as OrganizeOptions['handleDuplicates'] })}
            disabled={running}
          >
            <option value="keep-best">Keep best quality, remove extras</option>
            <option value="skip">Skip duplicate files entirely</option>
            <option value="keep-all">Keep all copies</option>
          </select>
        </SettingRow>

        {/* Separate videos */}
        <SettingRow
          label="Separate Videos"
          description="Put videos in a separate Photos/Videos subfolder"
        >
          <Toggle
            checked={opts.separateVideos}
            onChange={(v) => setOpts({ ...opts, separateVideos: v })}
            disabled={running}
          />
        </SettingRow>

        {/* Copy vs move */}
        <SettingRow
          label="Copy Instead of Move"
          description="Keep originals in place — safer, but uses more disk space"
        >
          <Toggle
            checked={opts.copyInsteadOfMove}
            onChange={(v) => setOpts({ ...opts, copyInsteadOfMove: v })}
            disabled={running}
          />
        </SettingRow>
      </div>

      {/* Summary */}
      <div className="card summary-card">
        <div className="summary-title">What will happen</div>
        <div className="summary-rows">
          <SummaryRow icon="📁" text={`Move ${scanResult.files.length.toLocaleString()} files from ${sourceDir}`} />
          <SummaryRow icon="🏠" text={`Into ${destDir} using ${opts.structure} structure`} />
          {opts.handleDuplicates === 'keep-best' && duplicatesToRemove > 0 && (
            <SummaryRow
              icon="🗑"
              text={`Remove ${duplicatesToRemove} duplicate files, saving ${fmtBytes(reclaimable)}`}
              warn
            />
          )}
          {opts.copyInsteadOfMove && (
            <SummaryRow icon="📋" text="Originals will be preserved (copy mode)" />
          )}
          {opts.separateVideos && (
            <SummaryRow icon="🎬" text="Videos will be in a Videos/ subfolder" />
          )}
        </div>
      </div>

      {running && (
        <div className="card">
          <div style={{ fontWeight: 600, marginBottom: 10 }}>Organizing…</div>
          <div className="progress-bar">
            <div className="progress-bar-fill" style={{ width: `${pct}%` }} />
          </div>
          <div style={{ marginTop: 8, fontSize: 12, color: 'var(--text-secondary)', display: 'flex', justifyContent: 'space-between' }}>
            <span>{pct}%</span>
            <span>{progress.current} / {progress.total}</span>
          </div>
          {progress.file && (
            <div style={{ marginTop: 6, fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {progress.file}
            </div>
          )}
        </div>
      )}

      {error && (
        <div className="error-banner">{error}</div>
      )}

      <div className="action-bar">
        <button className="btn btn-secondary action-bar-left" onClick={onBack} disabled={running}>
          ← Back
        </button>
        <button
          className="btn btn-primary btn-lg"
          onClick={runOrganize}
          disabled={running}
        >
          {running ? 'Working…' : 'Start Organizing →'}
        </button>
      </div>

      <style>{STYLES}</style>
    </div>
  )
}

function SettingRow({
  label,
  description,
  children
}: {
  label: string
  description: string
  children: React.ReactNode
}): React.ReactElement {
  return (
    <div className="setting-row card card-sm">
      <div className="setting-meta">
        <div className="setting-label">{label}</div>
        <div className="setting-desc">{description}</div>
      </div>
      <div className="setting-control">{children}</div>
    </div>
  )
}

function Toggle({
  checked,
  onChange,
  disabled
}: {
  checked: boolean
  onChange: (v: boolean) => void
  disabled?: boolean
}): React.ReactElement {
  return (
    <label className="toggle" style={{ opacity: disabled ? 0.5 : 1 }}>
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => !disabled && onChange(e.target.checked)}
        disabled={disabled}
      />
      <span className="toggle-track" />
      <span className="toggle-thumb" />
    </label>
  )
}

function SummaryRow({
  icon,
  text,
  warn
}: {
  icon: string
  text: string
  warn?: boolean
}): React.ReactElement {
  return (
    <div className={`summary-row ${warn ? 'warn' : ''}`}>
      <span>{icon}</span>
      <span>{text}</span>
    </div>
  )
}

function fmtBytes(bytes: number): string {
  if (bytes < 1024 ** 2) return `${(bytes / 1024).toFixed(0)} KB`
  if (bytes < 1024 ** 3) return `${(bytes / 1024 ** 2).toFixed(1)} MB`
  return `${(bytes / 1024 ** 3).toFixed(2)} GB`
}

const STYLES = `
.settings-grid { display: flex; flex-direction: column; gap: 10px; }
.setting-row { display: flex; align-items: center; justify-content: space-between; gap: 24px; }
.setting-meta { display: flex; flex-direction: column; gap: 3px; }
.setting-label { font-size: 14px; font-weight: 600; color: var(--text-primary); }
.setting-desc { font-size: 12px; color: var(--text-secondary); }
.setting-control { flex-shrink: 0; }

.summary-card { }
.summary-title { font-size: 13px; font-weight: 700; color: var(--text-secondary); text-transform: uppercase; letter-spacing: 0.06em; margin-bottom: 12px; }
.summary-rows { display: flex; flex-direction: column; gap: 8px; }
.summary-row { display: flex; align-items: flex-start; gap: 10px; font-size: 13px; color: var(--text-secondary); }
.summary-row.warn { color: var(--warning); }
.summary-row span:first-child { flex-shrink: 0; }

.error-banner { background: rgba(248,113,113,0.12); border: 1px solid rgba(248,113,113,0.3); border-radius: var(--radius-md); padding: 12px 16px; color: var(--danger); font-size: 13px; }
`
