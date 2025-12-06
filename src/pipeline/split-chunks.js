import fs from "fs";
import path from "path";
import { log, success } from "../utils/logger.js";

/**
 * Split frame data into chunks
 *
 * @param {Object[]} frames - Array of frame data
 * @param {number} [chunkSize=60] - Frames per chunk
 * @returns {Object[][]} - Array of chunks
 */
export function splitIntoChunks(frames, chunkSize = 60) {
  const chunks = [];
  for (let i = 0; i < frames.length; i += chunkSize) {
    chunks.push(frames.slice(i, i + chunkSize));
  }
  return chunks;
}

/**
 * Split silhouette data into chunk files and save
 *
 * @param {string} inputFile - Input JSON file (silhouette-data.json)
 * @param {string} outputDir - Output directory
 * @param {Object} options - Options
 * @param {number} [options.chunkSize=60] - Frames per chunk
 * @param {string} [options.chunksDir] - Custom chunks directory (default: outputDir/chunks)
 * @returns {Promise<string[]>} - Array of created chunk file paths
 */
export async function splitChunksToFiles(inputFile, outputDir, options = {}) {
  const { chunkSize = 60, chunksDir: customChunksDir } = options;

  // Check input file exists
  if (!fs.existsSync(inputFile)) {
    throw new Error(`Input file not found: ${inputFile}`);
  }

  // Load data
  const data = JSON.parse(fs.readFileSync(inputFile, "utf8"));

  log(`Total frames: ${data.length}`);
  log(`Chunk size: ${chunkSize} frames`);

  // Split into chunks
  const chunks = splitIntoChunks(data, chunkSize);
  log(`Creating ${chunks.length} chunks...`);

  // Create output directory
  const chunksDir = customChunksDir || path.join(outputDir, "chunks");
  if (!fs.existsSync(chunksDir)) {
    fs.mkdirSync(chunksDir, { recursive: true });
  }

  const chunkFiles = [];

  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i];
    const chunkNumber = String(i + 1).padStart(3, "0");
    const outputFile = path.join(chunksDir, `frames-${chunkNumber}.json`);

    fs.writeFileSync(outputFile, JSON.stringify(chunk));

    const fileSize = fs.statSync(outputFile).size;
    const fileSizeMB = (fileSize / (1024 * 1024)).toFixed(2);

    log(`  Chunk ${i + 1}/${chunks.length}: ${chunk.length} frames (${fileSizeMB} MB)`);
    chunkFiles.push(outputFile);
  }

  success(`Created ${chunks.length} chunk files`);
  log(`First chunk will be loaded immediately, rest in background`);

  return chunkFiles;
}
