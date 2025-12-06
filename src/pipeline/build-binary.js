import fs from "fs";
import path from "path";
import { log, success } from "../utils/logger.js";

/**
 * Convert coordinate to key string
 * @param {number[]} coord - [x, y]
 * @returns {string}
 */
function coordinateKey(coord) {
  return `${coord[0]},${coord[1]}`;
}

/**
 * Compute diff between two frames
 * @param {Object} previousFrame - Previous frame
 * @param {Object} currentFrame - Current frame
 * @returns {Object} - { removed: number[], added: number[][] }
 */
function computeDiff(previousFrame, currentFrame) {
  const prevSet = new Set(previousFrame.coordinates.map((c) => coordinateKey(c)));
  const currSet = new Set(currentFrame.coordinates.map((c) => coordinateKey(c)));

  // Removed coordinates (in previous frame but not in current)
  const removed = [];
  previousFrame.coordinates.forEach((coord, index) => {
    if (!currSet.has(coordinateKey(coord))) {
      removed.push(index);
    }
  });

  // Added coordinates (in current frame but not in previous)
  const added = [];
  currentFrame.coordinates.forEach((coord) => {
    if (!prevSet.has(coordinateKey(coord))) {
      added.push(coord);
    }
  });

  return { removed, added };
}

/**
 * Encode frame data to CADF differential binary
 *
 * Round-trip encoding:
 * Encoder simulates decoder behavior to ensure coordinate order consistency
 *
 * @param {Object[]} frames - Array of frame data
 * @returns {Buffer} - CADF binary
 */
export function encodeChunkToCADF(frames) {
  // First pass: Calculate buffer size and compute diffs using decoded frames
  let dataSize = 0;

  // First frame (complete data)
  // Frame header: frame number (2 bytes) + point count (4 bytes) = 6 bytes
  dataSize += 6;
  dataSize += frames[0].coordinates.length * 4; // Coordinates (x, y as UInt16)

  // Track decoded frames (for accurate diff calculation)
  const decodedFrames = [
    {
      frame: frames[0].frame,
      coordinates: [...frames[0].coordinates], // Deep copy
      totalPoints: frames[0].coordinates.length,
    },
  ];

  // Subsequent frames (diffs) - Use decoded frames as reference
  const diffs = [];
  for (let i = 1; i < frames.length; i++) {
    // Compute diff from previous decoded frame
    const diff = computeDiff(decodedFrames[i - 1], frames[i]);
    diffs.push(diff);

    // Frame header: frame number (2) + removed count (4) + added count (4) = 10 bytes
    dataSize += 10;
    dataSize += diff.removed.length * 4; // Removed indices (UInt32)
    dataSize += diff.added.length * 4; // Added coordinates (x, y as UInt16)

    // Simulate decoder to get actual decoded frame
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

    // Save decoded frame for next iteration
    decodedFrames.push({
      frame: frames[i].frame,
      coordinates: decodedCoords,
      totalPoints: decodedCoords.length,
    });
  }

  const headerSize = 8;
  const totalSize = headerSize + dataSize;
  const buffer = Buffer.alloc(totalSize);
  let offset = 0;

  // Write file header
  buffer.write("CADF", offset, 4, "ascii"); // Magic number
  offset += 4;
  buffer.writeUInt16LE(2, offset); // Version 2: UInt32 for counts/indices
  offset += 2;
  buffer.writeUInt16LE(frames.length, offset); // Frame count
  offset += 2;

  // Write first frame (complete data)
  const firstFrame = frames[0];
  buffer.writeUInt16LE(firstFrame.frame, offset);
  offset += 2;
  buffer.writeUInt32LE(firstFrame.coordinates.length, offset); // UInt32 for large point counts
  offset += 4;

  for (const [x, y] of firstFrame.coordinates) {
    buffer.writeUInt16LE(x, offset);
    offset += 2;
    buffer.writeUInt16LE(y, offset);
    offset += 2;
  }

  // Write subsequent frames (diffs)
  for (let i = 1; i < frames.length; i++) {
    const frame = frames[i];
    const diff = diffs[i - 1];

    // Frame header
    buffer.writeUInt16LE(frame.frame, offset);
    offset += 2;
    buffer.writeUInt32LE(diff.removed.length, offset); // UInt32
    offset += 4;
    buffer.writeUInt32LE(diff.added.length, offset); // UInt32
    offset += 4;

    // Removed indices (UInt32)
    for (const index of diff.removed) {
      buffer.writeUInt32LE(index, offset);
      offset += 4;
    }

    // Added coordinates
    for (const [x, y] of diff.added) {
      buffer.writeUInt16LE(x, offset);
      offset += 2;
      buffer.writeUInt16LE(y, offset);
      offset += 2;
    }
  }

  return buffer;
}

/**
 * Convert all JSON chunks to CADF binary
 *
 * @param {string} chunksDir - JSON chunks directory
 * @param {string} outputDir - Binary output directory
 * @returns {Promise<Object>} - { files: string[], stats: Object }
 */
export async function convertChunksToCADF(chunksDir, outputDir) {
  // Verify chunks directory exists
  if (!fs.existsSync(chunksDir)) {
    throw new Error(`Chunks directory not found: ${chunksDir}`);
  }

  // Create output directory
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  // Get chunk files
  const chunkFiles = fs
    .readdirSync(chunksDir)
    .filter((f) => f.match(/^frames-\d+\.json$/))
    .sort();

  if (chunkFiles.length === 0) {
    throw new Error(`No chunk files found in ${chunksDir}`);
  }

  log(`Converting ${chunkFiles.length} chunks to CADF binary...`);

  let totalJsonSize = 0;
  let totalBinarySize = 0;
  const outputFiles = [];

  for (let i = 0; i < chunkFiles.length; i++) {
    const chunkNum = String(i + 1).padStart(3, "0");
    const jsonFile = path.join(chunksDir, `frames-${chunkNum}.json`);
    const binaryFile = path.join(outputDir, `frames-${chunkNum}.bin`);

    // Read JSON
    const jsonData = JSON.parse(fs.readFileSync(jsonFile, "utf8"));
    const jsonSize = fs.statSync(jsonFile).size;
    totalJsonSize += jsonSize;

    // Convert to CADF binary
    const binaryData = encodeChunkToCADF(jsonData);
    fs.writeFileSync(binaryFile, binaryData);

    const binarySize = binaryData.length;
    totalBinarySize += binarySize;

    const reduction = ((1 - binarySize / jsonSize) * 100).toFixed(1);

    log(`  Chunk ${i + 1}/${chunkFiles.length}: ${(jsonSize / (1024 * 1024)).toFixed(2)} MB → ${(binarySize / (1024 * 1024)).toFixed(2)} MB (${reduction}% reduction)`);

    outputFiles.push(binaryFile);
  }

  const totalReduction = ((1 - totalBinarySize / totalJsonSize) * 100).toFixed(1);

  success(`Conversion complete!`);
  log(`  JSON total:   ${(totalJsonSize / (1024 * 1024)).toFixed(2)} MB`);
  log(`  Binary total: ${(totalBinarySize / (1024 * 1024)).toFixed(2)} MB`);
  log(`  Reduction:    ${totalReduction}%`);

  return {
    files: outputFiles,
    stats: {
      jsonSize: totalJsonSize,
      binarySize: totalBinarySize,
      reduction: parseFloat(totalReduction),
    },
  };
}
