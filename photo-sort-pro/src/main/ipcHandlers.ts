import { IpcMain, Dialog, BrowserWindow, app } from 'electron'
import fs from 'fs'
import path from 'path'
import os from 'os'
import { scanDirectory } from './fileScanner'
import { detectDuplicates } from './duplicateDetector'
import { organizeFiles } from './fileSorter'
import { OrganizeOptions, ScanResult, SuggestedFolder } from '../shared/types'

function getSuggestedFolders(): SuggestedFolder[] {
  const home = os.homedir()
  const platform = process.platform
  const suggestions: SuggestedFolder[] = []

  const add = (label: string, folderPath: string, icon: string, note?: string) => {
    if (fs.existsSync(folderPath)) {
      suggestions.push({ label, path: folderPath, icon, note })
    }
  }

  if (platform === 'darwin') {
    add('Pictures', path.join(home, 'Pictures'), '🖼️')
    add('Desktop', path.join(home, 'Desktop'), '🖥️')
    add('Downloads', path.join(home, 'Downloads'), '⬇️')
    add('iCloud Photos', path.join(home, 'Pictures', 'iCloud Photos', 'Downloads'), '☁️')

    // Apple Photos Library — offer the Originals folder inside the bundle
    const photosLib = path.join(home, 'Pictures', 'Photos Library.photoslibrary')
    const photosOriginalsLegacy = path.join(photosLib, 'Masters')      // macOS < Catalina
    const photosOriginals = path.join(photosLib, 'originals')           // macOS Catalina+
    if (fs.existsSync(photosOriginals)) {
      add('Photos Library (originals)', photosOriginals, '📷',
        'Apple Photos originals — use Copy mode to preserve your library')
    } else if (fs.existsSync(photosOriginalsLegacy)) {
      add('Photos Library (masters)', photosOriginalsLegacy, '📷',
        'Apple Photos originals — use Copy mode to preserve your library')
    }

    // iPhone backup photo export folders
    add('Photo Stream', path.join(home, 'Pictures', 'Photo Stream'), '📱')
  } else if (platform === 'win32') {
    const pictures = path.join(home, 'Pictures')
    const oneDrivePictures = path.join(home, 'OneDrive', 'Pictures')
    const googlePhotos = path.join(home, 'Pictures', 'Google Photos')

    add('My Pictures', pictures, '🖼️')
    add('Desktop', path.join(home, 'Desktop'), '🖥️')
    add('Downloads', path.join(home, 'Downloads'), '⬇️')
    add('OneDrive Pictures', oneDrivePictures, '☁️')
    add('Google Photos backup', googlePhotos, '📷')
  } else {
    // Linux
    add('Pictures', path.join(home, 'Pictures'), '🖼️')
    add('Desktop', path.join(home, 'Desktop'), '🖥️')
    add('Downloads', path.join(home, 'Downloads'), '⬇️')
  }

  return suggestions
}

export function registerIpcHandlers(ipcMain: IpcMain, dialog: Dialog): void {
  ipcMain.handle('folders:getSuggested', () => getSuggestedFolders())

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
