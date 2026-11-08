import React, { useState, useCallback } from 'react'
import WelcomeScreen from './components/WelcomeScreen'
import ScanScreen from './components/ScanScreen'
import DuplicatesScreen from './components/DuplicatesScreen'
import OrganizeScreen from './components/OrganizeScreen'
import ResultsScreen from './components/ResultsScreen'
import { ScanResult, OrganizeResult, DuplicateGroup } from '../../shared/types'
import './styles/app.css'

export type Screen = 'welcome' | 'scan' | 'duplicates' | 'organize' | 'results'

const STEPS: { id: Screen; label: string }[] = [
  { id: 'welcome',    label: 'Select Folder' },
  { id: 'scan',       label: 'Scan' },
  { id: 'duplicates', label: 'Review Duplicates' },
  { id: 'organize',   label: 'Organize' },
  { id: 'results',    label: 'Done' }
]

export default function App(): React.ReactElement {
  const [screen, setScreen] = useState<Screen>('welcome')
  const [sourceDir, setSourceDir] = useState('')
  const [destDir, setDestDir] = useState('')
  const [scanResult, setScanResult] = useState<ScanResult | null>(null)
  const [organizeResult, setOrganizeResult] = useState<OrganizeResult | null>(null)
  const [duplicateGroups, setDuplicateGroups] = useState<DuplicateGroup[]>([])

  const goTo = useCallback((s: Screen) => setScreen(s), [])

  const currentStep = STEPS.findIndex((s) => s.id === screen)

  return (
    <div className="app-shell">
      <TitleBar />
      <StepBar steps={STEPS} current={currentStep} />
      <main className="app-content">
        {screen === 'welcome' && (
          <WelcomeScreen
            onStart={(src, dst) => {
              setSourceDir(src)
              setDestDir(dst)
              goTo('scan')
            }}
          />
        )}
        {screen === 'scan' && (
          <ScanScreen
            sourceDir={sourceDir}
            onDone={(result) => {
              setScanResult(result)
              setDuplicateGroups(result.duplicates)
              goTo('duplicates')
            }}
            onBack={() => goTo('welcome')}
          />
        )}
        {screen === 'duplicates' && scanResult && (
          <DuplicatesScreen
            scanResult={scanResult}
            duplicateGroups={duplicateGroups}
            onGroupsChange={setDuplicateGroups}
            onNext={() => goTo('organize')}
            onBack={() => goTo('scan')}
          />
        )}
        {screen === 'organize' && scanResult && (
          <OrganizeScreen
            sourceDir={sourceDir}
            destDir={destDir}
            scanResult={{ ...scanResult, duplicates: duplicateGroups }}
            onDone={(r) => {
              setOrganizeResult(r)
              goTo('results')
            }}
            onBack={() => goTo('duplicates')}
          />
        )}
        {screen === 'results' && organizeResult && (
          <ResultsScreen
            result={organizeResult}
            onRestart={() => {
              setScanResult(null)
              setOrganizeResult(null)
              setDuplicateGroups([])
              goTo('welcome')
            }}
          />
        )}
      </main>
    </div>
  )
}

function TitleBar(): React.ReactElement {
  return (
    <div className="titlebar">
      <div className="titlebar-drag" />
      <span className="titlebar-title">
        <span className="titlebar-icon">✦</span> Photo Sort Pro
      </span>
      <div className="titlebar-drag" />
    </div>
  )
}

function StepBar({
  steps,
  current
}: {
  steps: { id: Screen; label: string }[]
  current: number
}): React.ReactElement {
  return (
    <nav className="stepbar">
      {steps.map((step, i) => (
        <React.Fragment key={step.id}>
          <div
            className={`stepbar-item ${
              i < current ? 'done' : i === current ? 'active' : ''
            }`}
          >
            <span className="stepbar-num">{i < current ? '✓' : i + 1}</span>
            <span className="stepbar-label">{step.label}</span>
          </div>
          {i < steps.length - 1 && (
            <div className={`stepbar-connector ${i < current ? 'done' : ''}`} />
          )}
        </React.Fragment>
      ))}
    </nav>
  )
}
