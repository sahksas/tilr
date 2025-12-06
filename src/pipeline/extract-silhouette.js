import fs from "fs";
import path from "path";
import { log, success, verbose, progress } from "../utils/logger.js";

/**
 * Extract silhouette coordinates from a single image
 *
 * @param {string} imagePath - Image file path
 * @param {number} frameNumber - Frame number
 * @param {Object} options - Options
 * @param {number} [options.tileSize=8] - Tile size
 * @param {number} [options.brightnessMin=10] - Minimum brightness threshold
 * @param {number} [options.brightnessMax=120] - Maximum brightness threshold
 * @param {number} [options.greenRatio=1.5] - Green color ratio threshold
 * @returns {Promise<Object>} - Frame data { frame, coordinates, totalPoints }
 */
export async function extractCoordinates(imagePath, frameNumber, options = {}) {
  const {
    tileSize = 8,
    brightnessMin = 10,
    brightnessMax = 120,
    greenRatio = 1.5,
  } = options;

  // Dynamic import for ESM module
  const { Jimp } = await import("jimp");
  const image = await Jimp.read(imagePath);
  const { width, height } = image.bitmap;

  const coordinates = [];
  const data = image.bitmap.data;

  // Sample at tile resolution
  for (let y = 0; y < height; y += tileSize) {
    for (let x = 0; x < width; x += tileSize) {
      // Calculate pixel index in bitmap data
      const idx = (y * width + x) * 4;
      const r = data[idx];
      const g = data[idx + 1];
      const b = data[idx + 2];

      // Calculate brightness
      const brightness = (r + g + b) / 3;

      // Detect dark pixels (darker than background)
      // Exclude pure black (video borders)
      if (brightness > brightnessMin && brightness < brightnessMax) {
        // Exclude too-green pixels (carpet background)
        const greenRatioValue = g / (r + b + 1);
        if (greenRatioValue < greenRatio) {
          const tileX = Math.floor(x / tileSize);
          const tileY = Math.floor(y / tileSize);
          coordinates.push([tileX, tileY]);
        }
      }
    }
  }

  return {
    frame: frameNumber,
    coordinates: coordinates,
    totalPoints: coordinates.length,
  };
}

/**
 * Extract all silhouette coordinates from frames directory
 *
 * @param {string} framesDir - Frames directory
 * @param {string} outputDir - Output directory
 * @param {Object} options - Options
 * @returns {Promise<Object[]>} - Array of frame data
 */
export async function extractSilhouetteFromFrames(
  framesDir,
  outputDir,
  options = {}
) {
  // Get frame files
  const files = fs
    .readdirSync(framesDir)
    .filter((f) => f.match(/^frame-\d+\.jpg$/))
    .sort();

  if (files.length === 0) {
    throw new Error(`No frame-*.jpg files found in: ${framesDir}`);
  }

  log(`Processing ${files.length} frames...`);

  const results = [];

  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    const frameMatch = file.match(/frame-(\d+)\.jpg/);
    if (!frameMatch) continue;

    const frameIndex = parseInt(frameMatch[1]) - 1;
    const imagePath = path.join(framesDir, file);

    try {
      const result = await extractCoordinates(imagePath, frameIndex, options);
      results.push(result);
      verbose(`Frame ${frameIndex + 1}: ${result.totalPoints} points`);

      // Show progress every 10%
      if ((i + 1) % Math.ceil(files.length / 10) === 0) {
        progress(i + 1, files.length, `${result.totalPoints} points`);
      }
    } catch (err) {
      throw new Error(`Frame ${frameIndex + 1}: ${err.message}`);
    }
  }

  // Save as JSON
  const outputPath = path.join(outputDir, "silhouette-data.json");
  fs.writeFileSync(outputPath, JSON.stringify(results, null, 2));

  // Show summary
  const totalPoints = results.reduce((sum, r) => sum + r.totalPoints, 0);
  const avgPoints = results.length > 0 ? totalPoints / results.length : 0;

  success(`Processed ${results.length} frames`);
  log(`  Total points: ${totalPoints}`);
  log(`  Average points/frame: ${avgPoints.toFixed(1)}`);
  log(`  Output: ${outputPath}`);

  return results;
}
