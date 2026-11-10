/**
 * Worker thread entry point.
 *
 * Receives { filePath, ext } messages and replies with the analysis result.
 * Running analysis in worker threads lets us process multiple files in
 * parallel (one worker per CPU core) without blocking the main thread or
 * the Electron event loop.
 */

import { workerData, parentPort } from 'worker_threads'
import { analyzeImage, analyzeVideo } from './qualityAnalyzer'
import { formatRank, getMediaType, md5File } from './fileScanner'
import path from 'path'
import fs from 'fs'
import crypto from 'crypto'

if (!parentPort) process.exit(1)

parentPort.on('message', async (msg: { id: number; filePath: string }) => {
  const { id, filePath } = msg
  const ext = path.extname(filePath).toLowerCase()
  const type = getMediaType(ext)
  const rank = formatRank(ext)

  let stat: fs.Stats
  try {
    stat = fs.statSync(filePath)
  } catch {
    parentPort!.postMessage({ id, error: 'stat failed' })
    return
  }

  const result: Record<string, unknown> = {
    size: stat.size,
    mtime: stat.mtimeMs,
    qualityScore: 0,
    formatRank: rank
  }

  try {
    const hash = await md5File(filePath)
    result.hash = hash
  } catch { /* skip */ }

  try {
    if (type === 'photo') {
      const info = await analyzeImage(filePath)
      Object.assign(result, info)
    } else if (type === 'video') {
      const info = await analyzeVideo(filePath)
      Object.assign(result, info)
    }
  } catch { /* skip */ }

  const pixels = ((result.width as number) ?? 0) * ((result.height as number) ?? 0)
  result.qualityScore =
    (pixels / 1_000_000) * rank + ((stat.size) / 1_000_000) * 10

  parentPort!.postMessage({ id, result })
})
