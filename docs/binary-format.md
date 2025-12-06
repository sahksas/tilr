# Binary Format Specification

Detailed specification of the two binary formats used in tile animation.

## Format Overview

| Format | Magic  | Version | Use Case                           | Size Efficiency           |
| ------ | ------ | ------- | ---------------------------------- | ------------------------- |
| CATF   | "CATF" | 1       | Standard binary (full frame data)  | 55.6% reduction from JSON |
| CADF   | "CADF" | 2       | Differential binary (frame diffs)  | 94.8% reduction from JSON |

## CATF (CAT Format) - Standard Binary Format

Stores complete coordinate data for each frame.

### File Header (8 bytes)

| Offset | Size | Type    | Description          |
| ------ | ---- | ------- | -------------------- |
| 0      | 4    | char[4] | Magic number: "CATF" |
| 4      | 2    | uint16  | Version: 1           |
| 6      | 2    | uint16  | Total frame count    |

### Frame Data (repeated for each frame)

| Offset | Size | Type         | Description               |
| ------ | ---- | ------------ | ------------------------- |
| 0      | 2    | uint16       | Frame number              |
| 2      | 2    | uint16       | Point count               |
| 4      | n\*4 | uint16[n][2] | Coordinates: [x, y] pairs |

### Encoding Example

```javascript
// Write header
buffer.write("CATF", 0, 4, "ascii");
buffer.writeUInt16LE(1, 4); // version
buffer.writeUInt16LE(60, 6); // 60 frames

// Write frame data
for (const frame of frames) {
  buffer.writeUInt16LE(frame.frame, offset);
  offset += 2;
  buffer.writeUInt16LE(frame.coordinates.length, offset);
  offset += 2;

  for (const [x, y] of frame.coordinates) {
    buffer.writeUInt16LE(x, offset);
    offset += 2;
    buffer.writeUInt16LE(y, offset);
    offset += 2;
  }
}
```

### Decoding Example

```javascript
const view = new DataView(arrayBuffer);
let offset = 0;

// Read header
const magic = String.fromCharCode(
  view.getUint8(0),
  view.getUint8(1),
  view.getUint8(2),
  view.getUint8(3)
);
const version = view.getUint16(4, true);
const frameCount = view.getUint16(6, true);
offset = 8;

// Read frame data
const frames = [];
for (let i = 0; i < frameCount; i++) {
  const frameNumber = view.getUint16(offset, true);
  offset += 2;
  const pointCount = view.getUint16(offset, true);
  offset += 2;

  const coordinates = [];
  for (let j = 0; j < pointCount; j++) {
    const x = view.getUint16(offset, true);
    offset += 2;
    const y = view.getUint16(offset, true);
    offset += 2;
    coordinates.push([x, y]);
  }

  frames.push({ frame: frameNumber, coordinates });
}
```

## CADF (CAT Diff Format) - Differential Binary Format

First frame stores complete data, subsequent frames store only differences. **Achieves 88.4% additional reduction**.

### File Header (8 bytes)

| Offset | Size | Type    | Description          |
| ------ | ---- | ------- | -------------------- |
| 0      | 4    | char[4] | Magic number: "CADF" |
| 4      | 2    | uint16  | Version: 2           |
| 6      | 2    | uint16  | Total frame count    |

### First Frame (complete data)

| Offset | Size | Type         | Description                      |
| ------ | ---- | ------------ | -------------------------------- |
| 0      | 2    | uint16       | Frame number                     |
| 2      | 4    | uint32       | Point count (v2: supports >64K)  |
| 6      | n\*4 | uint16[n][2] | Coordinates: [x, y] pairs        |

### Subsequent Frames (differential data)

| Offset  | Size | Type         | Description                      |
| ------- | ---- | ------------ | -------------------------------- |
| 0       | 2    | uint16       | Frame number                     |
| 2       | 4    | uint32       | Removed count (v2: supports >64K)|
| 6       | 4    | uint32       | Added count (v2: supports >64K)  |
| 10      | r\*4 | uint32[r]    | Removed indices (v2: uint32)     |
| 10+r\*4 | a\*4 | uint16[a][2] | Added coordinates: [x, y] pairs  |

### Version History

| Version | Changes                                                    |
| ------- | ---------------------------------------------------------- |
| 1       | Original format (uint16 for all counts/indices)            |
| 2       | uint32 for point count, removed/added counts, and indices  |

Version 2 supports 4K+ video with >65,535 points per frame.

### Round-Trip Encoding

**Important**: The encoder simulates decoder behavior to ensure coordinate order consistency.

#### The Problem

Standard encoding:

```
Frame 0: [A, B, C, D, E]
Frame 1: [A, C, D, F, G]  → Diff: removed[1,4], added[F,G]
```

When the decoder applies this:

```
[A, B, C, D, E]
→ remove[4]: [A, B, C, D]
→ remove[1]: [A, C, D]
→ add[F,G]: [A, C, D, F, G]  ✅ Correct
```

However, if we compute the next frame from the original Frame 1:

```
Compute Frame 2 from original Frame 1 [A, C, D, F, G]  ❌ Coordinate order differs
```

#### The Solution

The encoder simulates decoding for each frame:

```javascript
// Track decoded frames
const decodedFrames = [
  { coordinates: [...frames[0].coordinates] }, // First frame
];

for (let i = 1; i < frames.length; i++) {
  // Compute diff from previous decoded frame
  const diff = computeDiff(decodedFrames[i - 1], frames[i]);

  // Simulate decoder behavior
  const decodedCoords = [...decodedFrames[i - 1].coordinates];

  // Apply removals (descending order)
  const sortedRemovals = [...diff.removed].sort((a, b) => b - a);
  for (const index of sortedRemovals) {
    decodedCoords.splice(index, 1);
  }

  // Apply additions
  for (const coord of diff.added) {
    decodedCoords.push(coord);
  }

  // Save as reference for next frame
  decodedFrames.push({ coordinates: decodedCoords });
}
```

### Encoding Example

```javascript
function encodeChunkToDiffBinary(frames) {
  // Header
  buffer.write("CADF", 0, 4, "ascii");
  buffer.writeUInt16LE(1, 4);
  buffer.writeUInt16LE(frames.length, 6);
  let offset = 8;

  // First frame (complete data)
  const firstFrame = frames[0];
  buffer.writeUInt16LE(firstFrame.frame, offset);
  offset += 2;
  buffer.writeUInt16LE(firstFrame.coordinates.length, offset);
  offset += 2;

  for (const [x, y] of firstFrame.coordinates) {
    buffer.writeUInt16LE(x, offset);
    offset += 2;
    buffer.writeUInt16LE(y, offset);
    offset += 2;
  }

  // Track decoded frames
  const decodedFrames = [{ coordinates: [...firstFrame.coordinates] }];

  // Subsequent frames (diffs)
  for (let i = 1; i < frames.length; i++) {
    // Compute diff from previous decoded frame
    const diff = computeDiff(decodedFrames[i - 1], frames[i]);

    // Header
    buffer.writeUInt16LE(frames[i].frame, offset);
    offset += 2;
    buffer.writeUInt16LE(diff.removed.length, offset);
    offset += 2;
    buffer.writeUInt16LE(diff.added.length, offset);
    offset += 2;

    // Removed indices
    for (const index of diff.removed) {
      buffer.writeUInt16LE(index, offset);
      offset += 2;
    }

    // Added coordinates
    for (const [x, y] of diff.added) {
      buffer.writeUInt16LE(x, offset);
      offset += 2;
      buffer.writeUInt16LE(y, offset);
      offset += 2;
    }

    // Simulate decoder
    const decodedCoords = [...decodedFrames[i - 1].coordinates];
    const sortedRemovals = [...diff.removed].sort((a, b) => b - a);
    for (const index of sortedRemovals) {
      decodedCoords.splice(index, 1);
    }
    for (const coord of diff.added) {
      decodedCoords.push(coord);
    }
    decodedFrames.push({ coordinates: decodedCoords });
  }

  return buffer;
}
```

### Decoding Example

```javascript
function decodeDiffBinaryChunk(arrayBuffer) {
  const view = new DataView(arrayBuffer);
  let offset = 0;

  // Read header
  const magic = String.fromCharCode(
    view.getUint8(0),
    view.getUint8(1),
    view.getUint8(2),
    view.getUint8(3)
  );
  if (magic !== "CADF") {
    throw new Error(`Invalid format. Expected CADF, got ${magic}`);
  }

  const version = view.getUint16(4, true);
  const frameCount = view.getUint16(6, true);
  offset = 8;

  const frames = [];

  // First frame (complete data)
  const firstFrameNumber = view.getUint16(offset, true);
  offset += 2;
  const firstPointCount = view.getUint16(offset, true);
  offset += 2;

  const firstCoordinates = [];
  for (let j = 0; j < firstPointCount; j++) {
    const x = view.getUint16(offset, true);
    offset += 2;
    const y = view.getUint16(offset, true);
    offset += 2;
    firstCoordinates.push([x, y]);
  }

  frames.push({
    frame: firstFrameNumber,
    coordinates: firstCoordinates,
  });

  // Subsequent frames (diffs)
  for (let i = 1; i < frameCount; i++) {
    const frameNumber = view.getUint16(offset, true);
    offset += 2;
    const removedCount = view.getUint16(offset, true);
    offset += 2;
    const addedCount = view.getUint16(offset, true);
    offset += 2;

    // Copy previous frame's coordinates
    const prevCoordinates = [...frames[i - 1].coordinates];

    // Read removed indices
    const removedIndices = [];
    for (let j = 0; j < removedCount; j++) {
      const index = view.getUint16(offset, true);
      offset += 2;
      removedIndices.push(index);
    }

    // Sort descending and remove
    removedIndices.sort((a, b) => b - a);
    for (const index of removedIndices) {
      prevCoordinates.splice(index, 1);
    }

    // Read and add coordinates
    for (let j = 0; j < addedCount; j++) {
      const x = view.getUint16(offset, true);
      offset += 2;
      const y = view.getUint16(offset, true);
      offset += 2;
      prevCoordinates.push([x, y]);
    }

    frames.push({
      frame: frameNumber,
      coordinates: prevCoordinates,
    });
  }

  return frames;
}
```

## Data Types and Limits

### Coordinates (uint16)

- **Range**: 0 - 65,535
- **Use case**: Tile coordinates (x, y)
- For 4K video (3840x2160) with tile size 8: max 480x270 tiles

### Counts and Indices (uint32 in v2)

- **Range**: 0 - 4,294,967,295
- **Use case**: Point count, removed/added counts, removal indices
- Supports high-resolution video with >65K points per frame

### File Size Estimation

**CATF**:

```
File Size = 8 (header) + Σ(4 + point_count * 4) for each frame
```

**CADF**:

```
First Frame = 4 + point_count * 4
Diff Frame = 6 + removed_count * 2 + added_count * 4

File Size = 8 (header) + First Frame + Σ(Diff Frames)
```

## Differential Efficiency

Typical diff statistics for tile animation (60-frame chunks):

| Chunk | Avg Points/Frame | Avg Removed | Avg Added | Efficiency |
| ----- | ---------------- | ----------- | --------- | ---------- |
| 1     | 14,200           | 1,200       | 1,250     | 91.2%      |
| 2     | 15,300           | 1,450       | 1,500     | 90.5%      |
| 3     | 13,800           | 1,100       | 1,150     | 91.8%      |
| 4     | 18,000           | 2,800       | 2,900     | 84.3%      |
| 5     | 17,500           | 2,750       | 2,800     | 84.8%      |
| 6     | 13,200           | 1,300       | 1,350     | 90.0%      |
| 7     | 12,800           | 1,450       | 1,500     | 88.3%      |

**Efficiency** = 1 - (removed + added) / avg_points

Higher efficiency indicates smaller changes between frames.

## Endianness

All numeric values are encoded in **Little-Endian** (LE).

In JavaScript's `DataView`:

- `getUint16(offset, true)` - Little-Endian read
- `writeUInt16LE(value, offset)` - Little-Endian write (Node.js Buffer)

## Versioning

### CADF Version History

- **Version 1**: Original specification (uint16 for all numeric fields)
- **Version 2**: Extended support for large frames (uint32 for counts/indices)

Decoders should implement version checking:

```javascript
if (version > 2) {
  throw new Error(`Unsupported format version: ${version}`);
}

// Handle version-specific field sizes
if (version >= 2) {
  pointCount = view.getUint32(offset, true);
  offset += 4;
} else {
  pointCount = view.getUint16(offset, true);
  offset += 2;
}
```

## Testing and Validation

### Round-Trip Test

```bash
pnpm tile-animation:test
```

Expected output:

```
=== Test Results ===

Original JSON frames: 60
Decoded frames: 60

Frame 0:
  Original points: 14250
  Decoded points:  14250
  ✅ Match!

Frame 1:
  Original points: 14320
  Decoded points:  14320
  ✅ Match!

Frame 2:
  Original points: 14180
  Decoded points:  14180
  ✅ Match!
```

### Error Cases

**Magic Number Mismatch**:

```javascript
if (magic !== "CADF") {
  throw new Error("Invalid binary format");
}
```

**Coordinate Out of Range**:

```javascript
if (x > 65535 || y > 65535) {
  throw new Error("Coordinate out of range");
}
```

**Index Out of Range**:

```javascript
if (removedIndex >= prevCoordinates.length) {
  throw new Error("Invalid removal index");
}
```

## Related Documentation

- [Generation Pipeline](./pipeline.md)
- [Optimization Report](./optimization.md)
