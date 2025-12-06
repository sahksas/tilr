# Tile Animation Generation Pipeline

A pipeline for generating web browser-playable tile animations from video files.

## Overview

Generates animation data in a highly efficient differential binary format (CADF) from video files (MP4).

## Pipeline Steps

### Step 1: Frame Extraction

**Process**:
- Extract frame images from video using ffmpeg (default: 15 FPS)
- Save as JPG format

**CLI Options**:
```bash
npx tilr video.mp4 --fps 15
```

### Step 2: Silhouette Extraction

**Process**:
- Analyze each frame image using Jimp
- Detect silhouette regions based on brightness and color information
- Convert to tile coordinates
- Save as JSON format

**Parameters**:
| Parameter | Default | Description |
|-----------|---------|-------------|
| tileSize | 8 | Tile size (px) |
| brightnessMin | 10 | Minimum brightness threshold |
| brightnessMax | 120 | Maximum brightness threshold |
| greenRatio | 1.5 | Green color ratio threshold |

### Step 3: Chunk Splitting

**Process**:
- Split large JSON into manageable sizes
- For progressive loading

**Parameters**:
| Parameter | Default | Description |
|-----------|---------|-------------|
| chunkSize | 60 | Frames per chunk |

### Step 4: CADF Binary Conversion

**Process**:
- JSON → CADF (CAT Diff Format) conversion
- First frame: Complete data
- Subsequent frames: Differences from previous frame (removed/added coordinates)
- **Round-trip encoding**: Ensures coordinate order consistency

## CLI Usage

### Basic Usage

```bash
# Generate tile animation from video
npx tilr video.mp4 -o ./output
```

### All Options

```bash
npx tilr video.mp4 -o ./output \
  --fps 15 \
  --tile-size 8 \
  --chunk-size 60 \
  --brightness-min 10 \
  --brightness-max 120 \
  --green-ratio 1.5 \
  --verbose
```

## Programmatic API

```javascript
import { generateTileAnimation } from 'tilr';

const result = await generateTileAnimation({
  inputVideo: './video.mp4',
  outputDir: './output',
  fps: 15,
  tileSize: 8,
  chunkSize: 60,
  verbose: true,
});

console.log(`Generated ${result.totalChunks} chunks`);
console.log(`Size reduction: ${result.stats.reduction}%`);
```

### Individual Functions

```javascript
import {
  extractFrames,
  extractSilhouetteFromFrames,
  splitChunksToFiles,
  convertChunksToCADF,
} from 'tilr';

// Step 1: Frame extraction
const frameFiles = await extractFrames(videoPath, outputDir, { fps: 15 });

// Step 2: Silhouette extraction
const frames = await extractSilhouetteFromFrames(framesDir, outputDir, {
  tileSize: 8,
});

// Step 3: Chunk splitting
const chunkFiles = await splitChunksToFiles(silhouetteFile, outputDir, {
  chunkSize: 60,
});

// Step 4: Binary conversion
const { files, stats } = await convertChunksToCADF(chunksDir, outputDir);
```

## Output Directory Structure

```
output/
├── frames/             # Extracted frame images (intermediate files)
│   ├── frame-001.jpg
│   ├── frame-002.jpg
│   └── ...
├── silhouette-data.json  # Silhouette coordinate data
├── chunks/             # JSON chunks (intermediate files)
│   ├── frames-001.json
│   ├── frames-002.json
│   └── ...
├── frames-001.bin      # CADF binary (final output)
├── frames-002.bin
├── ...
└── config.json         # Metadata
```

## Optimization Results

| Format | Size | Reduction |
|--------|------|-----------|
| Original JSON | 52.86 MB | - |
| CADF Binary | 2.73 MB | 94.8% |
| After Brotli compression | 0.91 MB | 98.3% |

## Troubleshooting

### ffmpeg not found

```
Error: ffmpeg is not installed
```

Install ffmpeg:
```bash
# Ubuntu/Debian
sudo apt-get install ffmpeg

# macOS
brew install ffmpeg

# Windows
# https://ffmpeg.org/download.html
```

### Coordinates are misaligned

Run round-trip test:
```bash
npm test
```

Verify that all tests end with "Match!".

## Related Documentation

- [Binary Format Specification](./binary-format.md)
