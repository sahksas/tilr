import { execSync } from "child_process";

/**
 * Check if ffmpeg is installed
 * @returns {boolean}
 */
export function checkFfmpegInstalled() {
  try {
    execSync("ffmpeg -version", { stdio: "pipe" });
    return true;
  } catch {
    return false;
  }
}

/**
 * Print ffmpeg installation instructions when not installed
 */
export function printFfmpegInstallInstructions() {
  console.error("\n❌ Error: ffmpeg is not installed or not in PATH");
  console.error("\nInstall ffmpeg:");
  console.error("  Ubuntu/Debian: sudo apt-get install ffmpeg");
  console.error("  macOS: brew install ffmpeg");
  console.error("  Windows: Download from https://ffmpeg.org/download.html");
}
