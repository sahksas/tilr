/**
 * Tile Animation Generator
 * Generates tile-based animation data from video
 */

import fs from "fs";
import path from "path";
import os from "os";
import { extractFrames } from "./pipeline/extract-frames.js";
import { extractSilhouetteFromFrames } from "./pipeline/extract-silhouette.js";
import { splitChunksToFiles } from "./pipeline/split-chunks.js";
import { convertChunksToCADF } from "./pipeline/build-binary.js";
import { log, success, hint, setVerbose } from "./utils/logger.js";

// Export pipeline functions
export { extractFrames } from "./pipeline/extract-frames.js";
export {
  extractCoordinates,
  extractSilhouetteFromFrames,
} from "./pipeline/extract-silhouette.js";
export {
  splitIntoChunks,
  splitChunksToFiles,
} from "./pipeline/split-chunks.js";
export {
  encodeChunkToCADF,
  convertChunksToCADF,
} from "./pipeline/build-binary.js";

// Export decoder
export {
  decodeCADF,
  decodeFromBuffer,
  decodeFromFile,
} from "./decoder/decode-cadf.js";

// Export utilities
export { setVerbose } from "./utils/logger.js";
export { checkFfmpegInstalled } from "./utils/ffmpeg.js";

/**
 * Get default configuration
 * @returns {Object}
 */
export function getDefaultConfig() {
  return {
    fps: 15,
    tileSize: 8,
    chunkSize: 60,
    brightnessMin: 10,
    brightnessMax: 120,
    greenRatio: 1.5,
    verbose: false,
    keepIntermediate: false,
  };
}

/**
 * Remove directory recursively
 * @param {string} dirPath
 */
function removeDir(dirPath) {
  if (fs.existsSync(dirPath)) {
    fs.rmSync(dirPath, { recursive: true, force: true });
  }
}

/**
 * Clean up intermediate files
 * @param {string} tempDir - Temporary directory to remove
 */
function cleanupIntermediateFiles(tempDir) {
  removeDir(tempDir);
}

/**
 * Validate configuration
 * @param {Object} config
 * @throws {Error}
 */
export function validateConfig(config) {
  if (!config.inputVideo) {
    throw new Error("inputVideo is required");
  }
  if (!config.outputDir) {
    throw new Error("outputDir is required");
  }
  if (!fs.existsSync(config.inputVideo)) {
    throw new Error(`Video file not found: ${config.inputVideo}`);
  }
}

/**
 * Generate tile animation (full pipeline)
 *
 * @param {Object} config - Configuration
 * @param {string} config.inputVideo - Input video file path
 * @param {string} config.outputDir - Output directory
 * @param {number} [config.fps=15] - Frame rate
 * @param {number} [config.tileSize=8] - Tile size
 * @param {number} [config.chunkSize=60] - Chunk size
 * @param {number} [config.brightnessMin=10] - Minimum brightness threshold
 * @param {number} [config.brightnessMax=120] - Maximum brightness threshold
 * @param {number} [config.greenRatio=1.5] - Green color ratio
 * @param {boolean} [config.verbose=false] - Verbose logging
 * @param {boolean} [config.keepIntermediate=false] - Keep intermediate files
 * @returns {Promise<Object>} - Generation result
 */
export async function generateTileAnimation(config) {
  const defaults = getDefaultConfig();
  const options = { ...defaults, ...config };

  // Validate
  validateConfig(options);

  // Set verbose mode
  setVerbose(options.verbose);

  log(`\n🎬 Tile Animation Generator`);
  log(`Input: ${options.inputVideo}`);
  log(`Output: ${options.outputDir}\n`);

  // Create output directory
  if (!fs.existsSync(options.outputDir)) {
    fs.mkdirSync(options.outputDir, { recursive: true });
  }

  // Create temporary directory for intermediate files
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "tilr-"));
  const framesDir = path.join(tempDir, "frames");
  const chunksDir = path.join(tempDir, "chunks");
  const silhouetteFile = path.join(tempDir, "silhouette-data.json");

  try {
    // Step 1: Extract frames
    log(`\n📹 Step 1/4: Extracting frames...`);
    const frameFiles = await extractFrames(
      options.inputVideo,
      options.outputDir,
      { fps: options.fps, framesDir }
    );

    // Step 2: Extract silhouettes
    log(`\n🎯 Step 2/4: Extracting silhouettes...`);
    await extractSilhouetteFromFrames(framesDir, tempDir, {
      tileSize: options.tileSize,
      brightnessMin: options.brightnessMin,
      brightnessMax: options.brightnessMax,
      greenRatio: options.greenRatio,
    });

    // Step 3: Split into chunks
    log(`\n📦 Step 3/4: Splitting into chunks...`);
    await splitChunksToFiles(
      silhouetteFile,
      tempDir,
      { chunkSize: options.chunkSize, chunksDir }
    );

    // Step 4: Convert to binary
    log(`\n🔧 Step 4/4: Converting to CADF binary...`);
    const { files: binaryFiles, stats } = await convertChunksToCADF(
      chunksDir,
      options.outputDir
    );

    // Generate config.json
    const configFile = path.join(options.outputDir, "config.json");
    const configData = {
      totalFrames: frameFiles.length,
      totalChunks: binaryFiles.length,
      fps: options.fps,
      tileSize: options.tileSize,
      chunkSize: options.chunkSize,
    };
    fs.writeFileSync(configFile, JSON.stringify(configData, null, 2));

    log(`\n`);
    success(`Pipeline complete!`);
    log(`  Total frames: ${frameFiles.length}`);
    log(`  Total chunks: ${binaryFiles.length}`);
    log(`  Size reduction: ${stats.reduction}%`);
    log(`  Output: ${options.outputDir}`);
    log(``);
    hint(`👀 Preview your animation:`);
    hint(`   npx tilr view ${options.outputDir}`);

    return {
      outputFiles: binaryFiles,
      totalFrames: frameFiles.length,
      totalChunks: binaryFiles.length,
      stats,
    };
  } finally {
    // Cleanup intermediate files
    if (!options.keepIntermediate) {
      cleanupIntermediateFiles(tempDir);
    } else {
      log(`\n📁 Intermediate files kept at: ${tempDir}`);
    }
  }
}
