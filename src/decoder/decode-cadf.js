/**
 * CADF (CAT Diff Format) Decoder
 * Compatible with both browser and Node.js
 */

/**
 * Decode CADF binary from ArrayBuffer or Buffer
 *
 * @param {ArrayBuffer|Buffer} input - CADF binary data
 * @returns {Object[]} - Array of frame data [{ frame, coordinates, totalPoints }, ...]
 */
export function decodeCADF(input) {
  // Convert Node.js Buffer to ArrayBuffer
  let arrayBuffer;
  if (typeof Buffer !== "undefined" && Buffer.isBuffer(input)) {
    arrayBuffer = input.buffer.slice(
      input.byteOffset,
      input.byteOffset + input.byteLength
    );
  } else {
    arrayBuffer = input;
  }

  const view = new DataView(arrayBuffer);
  let offset = 0;

  // Read file header
  const magic = String.fromCharCode(
    view.getUint8(offset),
    view.getUint8(offset + 1),
    view.getUint8(offset + 2),
    view.getUint8(offset + 3)
  );
  offset += 4;

  if (magic !== "CADF") {
    throw new Error(
      `Invalid differential binary format. Expected CADF, got ${magic}`
    );
  }

  const version = view.getUint16(offset, true); // Little-endian
  offset += 2;

  if (version > 2) {
    throw new Error(`Unsupported format version: ${version}`);
  }

  const frameCount = view.getUint16(offset, true);
  offset += 2;

  const frames = [];

  // Read first frame (complete data)
  const firstFrameNumber = view.getUint16(offset, true);
  offset += 2;

  // Version 2 uses UInt32 for point count, version 1 uses UInt16
  let firstPointCount;
  if (version >= 2) {
    firstPointCount = view.getUint32(offset, true);
    offset += 4;
  } else {
    firstPointCount = view.getUint16(offset, true);
    offset += 2;
  }

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
    totalPoints: firstPointCount,
  });

  // Read subsequent frames (diffs)
  for (let i = 1; i < frameCount; i++) {
    const frameNumber = view.getUint16(offset, true);
    offset += 2;

    // Version 2 uses UInt32 for counts and indices
    let removedCount, addedCount;
    if (version >= 2) {
      removedCount = view.getUint32(offset, true);
      offset += 4;
      addedCount = view.getUint32(offset, true);
      offset += 4;
    } else {
      removedCount = view.getUint16(offset, true);
      offset += 2;
      addedCount = view.getUint16(offset, true);
      offset += 2;
    }

    // Get previous frame's coordinates
    const prevCoordinates = [...frames[i - 1].coordinates];

    // Read removed indices
    const removedIndices = [];
    for (let j = 0; j < removedCount; j++) {
      let index;
      if (version >= 2) {
        index = view.getUint32(offset, true);
        offset += 4;
      } else {
        index = view.getUint16(offset, true);
        offset += 2;
      }
      removedIndices.push(index);
    }

    // Sort descending and remove (to prevent index shift)
    removedIndices.sort((a, b) => b - a);
    for (const index of removedIndices) {
      prevCoordinates.splice(index, 1);
    }

    // Read and add new coordinates
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
      totalPoints: prevCoordinates.length,
    });
  }

  return frames;
}

/**
 * Decode directly from Node.js Buffer
 *
 * @param {Buffer} buffer - Node.js Buffer
 * @returns {Object[]} - Array of frame data
 */
export function decodeFromBuffer(buffer) {
  return decodeCADF(buffer);
}

/**
 * Decode from file path (Node.js only)
 *
 * @param {string} filePath - Binary file path
 * @returns {Promise<Object[]>} - Array of frame data
 */
export async function decodeFromFile(filePath) {
  // Dynamic import for Node.js fs
  const fs = await import("fs");
  const buffer = fs.readFileSync(filePath);
  return decodeCADF(buffer);
}
