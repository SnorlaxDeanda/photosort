import path from 'path'

interface ImageInfo {
  width?: number
  height?: number
  dateTaken?: string
  make?: string
  model?: string
  gps?: { lat: number; lon: number }
  phash?: string
}

interface VideoInfo {
  width?: number
  height?: number
  durationSec?: number
  dateTaken?: string
}

/** Parse EXIF and compute a perceptual hash for an image */
export async function analyzeImage(filePath: string): Promise<ImageInfo> {
  const result: ImageInfo = {}
  const ext = path.extname(filePath).toLowerCase()
  const isRaw = ['.raw', '.cr2', '.cr3', '.nef', '.orf', '.arw', '.dng', '.rw2', '.pef', '.srw'].includes(ext)

  try {
    // Dynamic import so missing native deps don't crash startup
    const exifr = await import('exifr')
    const exif = await exifr.default.parse(filePath, {
      tiff: true, exif: true, gps: true, ifd1: false
    }).catch(() => null)

    if (exif) {
      result.width = exif.ImageWidth ?? exif.ExifImageWidth ?? exif.PixelXDimension
      result.height = exif.ImageHeight ?? exif.ExifImageHeight ?? exif.PixelYDimension
      result.make = exif.Make
      result.model = exif.Model
      const d = exif.DateTimeOriginal ?? exif.DateTime ?? exif.CreateDate
      if (d) result.dateTaken = d instanceof Date ? d.toISOString() : String(d)
      if (exif.latitude != null && exif.longitude != null) {
        result.gps = { lat: exif.latitude, lon: exif.longitude }
      }
    }
  } catch {
    // exifr not available or failed
  }

  // For non-RAW images, use sharp to get dimensions and compute perceptual hash
  if (!isRaw) {
    try {
      const sharp = await import('sharp')
      const img = sharp.default(filePath)
      const meta = await img.metadata()
      if (!result.width) result.width = meta.width
      if (!result.height) result.height = meta.height

      // Perceptual hash: resize to 8×8 greyscale, get average, build bit string
      const { data } = await img
        .resize(8, 8, { fit: 'fill' })
        .greyscale()
        .raw()
        .toBuffer({ resolveWithObject: true })

      const avg = data.reduce((s, v) => s + v, 0) / data.length
      let bits = ''
      for (let i = 0; i < data.length; i++) {
        bits += data[i] >= avg ? '1' : '0'
      }
      // Convert bits to hex
      let hex = ''
      for (let i = 0; i < bits.length; i += 4) {
        hex += parseInt(bits.slice(i, i + 4), 2).toString(16)
      }
      result.phash = hex
    } catch {
      // sharp not available
    }
  }

  return result
}

/** Extract basic metadata from a video file */
export async function analyzeVideo(filePath: string): Promise<VideoInfo> {
  const result: VideoInfo = {}

  // Try reading MP4 atoms for date/dimensions via a minimal buffer read
  // For a production app you'd use ffprobe; here we do a lightweight approach
  try {
    const fs = await import('fs')
    const buf = Buffer.alloc(4096)
    const fd = fs.default.openSync(filePath, 'r')
    fs.default.readSync(fd, buf, 0, 4096, 0)
    fs.default.closeSync(fd)

    // Look for 'mvhd' atom which contains duration & creation time in MP4/MOV
    const mvhd = buf.indexOf(Buffer.from('mvhd'))
    if (mvhd !== -1 && mvhd + 24 < buf.length) {
      const version = buf[mvhd + 4]
      if (version === 0) {
        // Creation time is seconds since 1904-01-01
        const creationTime = buf.readUInt32BE(mvhd + 8)
        const mac1904 = new Date('1904-01-01T00:00:00Z').getTime()
        const date = new Date(mac1904 + creationTime * 1000)
        if (date.getFullYear() > 1970) {
          result.dateTaken = date.toISOString()
        }
        const timescale = buf.readUInt32BE(mvhd + 16)
        const duration = buf.readUInt32BE(mvhd + 20)
        if (timescale > 0) {
          result.durationSec = duration / timescale
        }
      }
    }
  } catch {
    // failed to read video metadata
  }

  return result
}

/** Compute Hamming distance between two hex perceptual hashes */
export function hammingDistance(h1: string, h2: string): number {
  if (h1.length !== h2.length) return Infinity
  let dist = 0
  for (let i = 0; i < h1.length; i++) {
    const b1 = parseInt(h1[i], 16)
    const b2 = parseInt(h2[i], 16)
    let xor = b1 ^ b2
    while (xor) {
      dist += xor & 1
      xor >>= 1
    }
  }
  return dist
}
