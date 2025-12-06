/**
 * CLI implementation
 */

import path from "node:path";
import { Command } from "commander";
import { generateTileAnimation, getDefaultConfig } from "./index.js";
import { startViewerServer, openBrowser } from "./viewer-server.js";

/**
 * Generate output directory name from video filename
 */
function getDefaultOutputDir(videoPath) {
  const basename = path.basename(videoPath, path.extname(videoPath));
  return `./${basename}`;
}

/**
 * Run CLI
 */
export function runCLI() {
  const defaults = getDefaultConfig();
  const program = new Command();

  program
    .name("tilr")
    .description("Generate tile-based animations from video files")
    .version("1.0.0");

  // view subcommand
  program
    .command("view <dir>")
    .description("Launch viewer for generated animation data")
    .option("-p, --port <port>", "Server port", "3000")
    .option("--no-open", "Don't open browser automatically")
    .action(async (dir, options) => {
      try {
        const port = parseInt(options.port);
        console.log(`Starting viewer server for: ${path.resolve(dir)}`);

        const { url } = await startViewerServer(dir, port);
        console.log(`Server running at: ${url}`);

        if (options.open) {
          console.log("Opening browser...");
          await openBrowser(url);
        }

        console.log("Press Ctrl+C to stop the server");
      } catch (error) {
        console.error(`Error: ${error.message}`);
        process.exit(1);
      }
    });

  // Default: generate command
  program
    .argument("<video>", "Input video file path")
    .option("-o, --output <dir>", "Output directory (default: ./<video-name>)")
    .option("--fps <number>", "Frame rate", String(defaults.fps))
    .option("--tile-size <number>", "Tile size in pixels", String(defaults.tileSize))
    .option("--chunk-size <number>", "Frames per chunk", String(defaults.chunkSize))
    .option(
      "--brightness-min <number>",
      "Minimum brightness threshold",
      String(defaults.brightnessMin)
    )
    .option(
      "--brightness-max <number>",
      "Maximum brightness threshold",
      String(defaults.brightnessMax)
    )
    .option(
      "--green-ratio <number>",
      "Green color ratio threshold",
      String(defaults.greenRatio)
    )
    .option("-v, --verbose", "Enable verbose logging", false)
    .option("--keep-intermediate", "Keep intermediate files (frames, chunks, etc.)", false)
    .action(async (video, options) => {
      try {
        const outputDir = options.output || getDefaultOutputDir(video);
        const config = {
          inputVideo: video,
          outputDir,
          fps: parseInt(options.fps),
          tileSize: parseInt(options.tileSize),
          chunkSize: parseInt(options.chunkSize),
          brightnessMin: parseInt(options.brightnessMin),
          brightnessMax: parseInt(options.brightnessMax),
          greenRatio: parseFloat(options.greenRatio),
          verbose: options.verbose,
          keepIntermediate: options.keepIntermediate,
        };

        await generateTileAnimation(config);
        process.exit(0);
      } catch (error) {
        console.error(`\n❌ Error: ${error.message}`);
        if (options.verbose) {
          console.error(error.stack);
        }
        process.exit(1);
      }
    });

  program.parse();
}
