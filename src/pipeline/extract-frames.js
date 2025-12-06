import fs from "fs";
import path from "path";
import { execSync } from "child_process";
import {
  checkFfmpegInstalled,
  printFfmpegInstallInstructions,
} from "../utils/ffmpeg.js";
import { log, success, error } from "../utils/logger.js";

/**
 * Extract frames from video
 *
 * @param {string} videoPath - Input video file path
 * @param {string} outputDir - Frame output directory
 * @param {Object} options - Options
 * @param {number} [options.fps=15] - Frame rate
 * @param {string} [options.framesDir] - Custom frames directory (default: outputDir/frames)
 * @returns {Promise<string[]>} - Array of extracted frame file paths
 */
export async function extractFrames(videoPath, outputDir, options = {}) {
  const { fps = 15, framesDir: customFramesDir } = options;

  // Check ffmpeg
  if (!checkFfmpegInstalled()) {
    printFfmpegInstallInstructions();
    throw new Error("ffmpeg is not installed");
  }

  // Check video file exists
  if (!fs.existsSync(videoPath)) {
    throw new Error(`Video file not found: ${videoPath}`);
  }

  // Create frame output directory
  const framesDir = customFramesDir || path.join(outputDir, "frames");
  if (!fs.existsSync(framesDir)) {
    fs.mkdirSync(framesDir, { recursive: true });
    log(`Created directory: ${framesDir}`);
  } else {
    // Cleanup existing frames
    const existingFrames = fs
      .readdirSync(framesDir)
      .filter((f) => f.match(/^frame-\d+\.jpg$/));

    if (existingFrames.length > 0) {
      log(`Cleaning up ${existingFrames.length} existing frame(s)...`);
      existingFrames.forEach((file) => {
        fs.unlinkSync(path.join(framesDir, file));
      });
    }
  }

  // Extract frames with ffmpeg
  const outputPattern = path.join(framesDir, "frame-%03d.jpg");
  const ffmpegCommand = `ffmpeg -i "${videoPath}" -vf fps=${fps} "${outputPattern}"`;

  log(`Extracting frames at ${fps} FPS...`);

  try {
    execSync(ffmpegCommand, {
      stdio: ["ignore", "pipe", "inherit"],
    });

    // List extracted frames
    const extractedFrames = fs
      .readdirSync(framesDir)
      .filter((f) => f.match(/^frame-\d+\.jpg$/))
      .sort()
      .map((f) => path.join(framesDir, f));

    const duration = (extractedFrames.length / fps).toFixed(1);
    success(`Extracted ${extractedFrames.length} frames (~${duration}s at ${fps} FPS)`);

    return extractedFrames;
  } catch (err) {
    error("ffmpeg command failed");
    throw err;
  }
}
