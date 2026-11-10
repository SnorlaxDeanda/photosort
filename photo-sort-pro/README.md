# Photo Sort Pro

A cross-platform desktop application (macOS & Windows) for scanning, deduplicating, and organizing your photo and video library.

## Features

| Feature | Details |
|---|---|
| **Deep duplicate detection** | Two-pass algorithm: exact content (MD5 hash) + visual similarity (perceptual hash via 8×8 greyscale comparison) |
| **Quality-aware selection** | Keeps the highest-quality copy: format rank (RAW > TIFF > PNG > HEIC > JPEG) × resolution × file size |
| **EXIF / metadata reading** | Reads date taken, camera make/model, GPS coordinates from photo EXIF data |
| **Date-based sorting** | Organizes into `Year/Month`, `Year/Month/Day`, `Year`, or flat structure |
| **Video support** | MP4, MOV, MKV, AVI, WebM, and more — alongside every major photo format including RAW |
| **Separate video folders** | Optionally splits photos and videos into `Photos/` and `Videos/` subfolders |
| **Copy or Move** | Choose to copy files (safe, originals preserved) or move them |
| **Review before committing** | Step-by-step wizard — review every duplicate group and choose which copy to keep |
| **Real-time progress** | Live progress bars for scanning, hashing, and organizing |
| **Space savings report** | Shows exactly how much disk space will be reclaimed |

## Supported Formats

**Photos:** JPEG, PNG, TIFF, WebP, HEIC/HEIF, AVIF, BMP, GIF, RAW (CR2, CR3, NEF, ORF, ARW, DNG, RW2, PEF, SRW)

**Videos:** MP4, MOV, M4V, MKV, AVI, WMV, WebM, FLV, MPG/MPEG, MTS/M2TS, 3GP

## Installing on macOS — Gatekeeper warning

Because the distributed DMG is not signed with an Apple Developer certificate, macOS Gatekeeper will block it. There are two ways to open it:

### Option A — Terminal (one command, recommended)
After dragging the app to `/Applications`, run this once in Terminal:

```bash
xattr -cr "/Applications/Photo Sort Pro.app"
```

Then double-click the app normally. macOS remembers the override permanently.

### Option B — System Settings
1. Open the DMG and drag the app to Applications
2. Double-click the app — it will be blocked
3. Go to **System Settings → Privacy & Security**
4. Scroll down to the "Security" section — click **Open Anyway**

### Option C — Sign and notarize yourself
If you have an Apple Developer account ($99/year) you can sign and notarize the app so it installs silently with no warnings. Add these secrets to your GitHub repository (Settings → Secrets → Actions) and re-run the workflow:

| Secret | Value |
|---|---|
| `CSC_LINK` | Base64-encoded `.p12` certificate: `base64 -i cert.p12 \| pbcopy` |
| `CSC_KEY_PASSWORD` | Password set when exporting the `.p12` |
| `APPLE_ID` | Your Apple ID email |
| `APPLE_ID_PASSWORD` | App-specific password from [appleid.apple.com](https://appleid.apple.com) |
| `APPLE_TEAM_ID` | 10-character team ID from [developer.apple.com](https://developer.apple.com/account) |

## Development

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build

# Package for distribution
npm run package
```

## How Duplicate Detection Works

1. **Pass 1 — Exact duplicates**: Files are grouped by size. For same-size groups, MD5 hashes are compared. Identical hashes = exact duplicate.

2. **Pass 2 — Visual near-duplicates** (photos only): Each photo is resized to 8×8 pixels in greyscale, then a 64-bit perceptual hash is computed. Files with a Hamming distance ≤ 8 bits (87.5% similarity) are flagged as visual duplicates.

3. **Quality scoring**: Each file receives a score based on `megapixels × format_rank + (file_size_MB × 10)`. The highest-scoring file is automatically chosen as the keeper.

## Tech Stack

- **Electron** — cross-platform desktop shell
- **React + TypeScript** — UI
- **Vite / electron-vite** — build tooling
- **sharp** — fast native image processing and perceptual hashing
- **exifr** — fast EXIF metadata parser

# Build: 2026-11-10T06:00:36Z
