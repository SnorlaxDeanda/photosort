import { IpcMain, Dialog, BrowserWindow } from 'electron'
import { scanDirectory } from './fileScanner'
import { detectDuplicates } from './duplicateDetector'
import { organizeFiles } from './fileSorter'
import { OrganizeOptions, ScanResult } from '../shared/types'

export function registerIpcHandlers(ipcMain: IpcMain, dialog: Dialog): void {
  ipcMain.handle('dialog:openFolder', async () => {
    const result = await dialog.showOpenDialog({
      properties: ['openDirectory']
    })
    return result.canceled ? null : result.filePaths[0]
  })

  ipcMain.handle('scan:start', async (event, sourceDir: string, similarityThreshold: number) => {
    const win = BrowserWindow.fromWebContents(event.sender)!

    const files = await scanDirectory(sourceDir, (progress) => {
      win.webContents.send('scan:progress', progress)
    })

    win.webContents.send('scan:progress', {
      phase: 'comparing',
      current: files.length,
      total: files.length,
      currentFile: ''
    })

    const duplicates = await detectDuplicates(
      files,
      similarityThreshold,
      (current, total) => {
        win.webContents.send('scan:progress', {
          phase: 'comparing',
          current,
          total,
          currentFile: ''
        })
      }
    )

    const scanResult: ScanResult = {
      files,
      duplicates,
      totalSize: files.reduce((s, f) => s + f.size, 0),
      photoCount: files.filter((f) => f.type === 'photo').length,
      videoCount: files.filter((f) => f.type === 'video').length
    }

    win.webContents.send('scan:progress', {
      phase: 'done',
      current: files.length,
      total: files.length,
      currentFile: ''
    })

    return scanResult
  })

  ipcMain.handle(
    'organize:start',
    async (event, scanResult: ScanResult, opts: OrganizeOptions) => {
      const win = BrowserWindow.fromWebContents(event.sender)!

      const result = await organizeFiles(
        scanResult.files,
        scanResult.duplicates,
        opts,
        (current, total, file) => {
          win.webContents.send('organize:progress', { current, total, file })
        }
      )

      return result
    }
  )

  ipcMain.handle('dialog:saveFolder', async () => {
    const result = await dialog.showOpenDialog({
      properties: ['openDirectory', 'createDirectory'],
      title: 'Choose destination folder'
    })
    return result.canceled ? null : result.filePaths[0]
  })
}
