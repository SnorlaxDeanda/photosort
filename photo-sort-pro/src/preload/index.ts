import { contextBridge, ipcRenderer } from 'electron'
import { OrganizeOptions, ScanResult, ScanProgress, OrganizeResult } from '../shared/types'

contextBridge.exposeInMainWorld('api', {
  openFolder: (): Promise<string | null> =>
    ipcRenderer.invoke('dialog:openFolder'),

  saveFolder: (): Promise<string | null> =>
    ipcRenderer.invoke('dialog:saveFolder'),

  startScan: (sourceDir: string, similarityThreshold: number): Promise<ScanResult> =>
    ipcRenderer.invoke('scan:start', sourceDir, similarityThreshold),

  startOrganize: (scanResult: ScanResult, opts: OrganizeOptions): Promise<OrganizeResult> =>
    ipcRenderer.invoke('organize:start', scanResult, opts),

  onScanProgress: (cb: (p: ScanProgress) => void) => {
    const handler = (_: unknown, p: ScanProgress) => cb(p)
    ipcRenderer.on('scan:progress', handler)
    return () => ipcRenderer.removeListener('scan:progress', handler)
  },

  onOrganizeProgress: (cb: (p: { current: number; total: number; file: string }) => void) => {
    const handler = (_: unknown, p: { current: number; total: number; file: string }) => cb(p)
    ipcRenderer.on('organize:progress', handler)
    return () => ipcRenderer.removeListener('organize:progress', handler)
  }
})
