/**
 * Viewer Server
 * A simple server for serving bin files and launching the viewer
 */

import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const MIME_TYPES = {
  ".html": "text/html",
  ".js": "application/javascript",
  ".css": "text/css",
  ".json": "application/json",
  ".bin": "application/octet-stream",
};

/**
 * Start viewer server
 * @param {string} dataDir - Directory containing bin files
 * @param {number} port - Port number
 * @returns {Promise<{ server: http.Server, url: string }>}
 */
export function startViewerServer(dataDir, port = 3000) {
  const viewerDir = path.join(__dirname, "..", "viewer");
  const absoluteDataDir = path.resolve(dataDir);

  // Get list of bin files
  function getBinFiles() {
    if (!fs.existsSync(absoluteDataDir)) {
      return [];
    }
    return fs
      .readdirSync(absoluteDataDir)
      .filter((f) => f.endsWith(".bin"))
      .sort();
  }

  const server = http.createServer((req, res) => {
    const url = new URL(req.url, `http://localhost:${port}`);
    const pathname = url.pathname;

    // CORS headers
    res.setHeader("Access-Control-Allow-Origin", "*");

    // API: bin file list
    if (pathname === "/api/files") {
      const files = getBinFiles();
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ files }));
      return;
    }

    // Serve bin files
    if (pathname.startsWith("/data/")) {
      const filename = pathname.slice(6); // Remove "/data/"
      const filePath = path.join(absoluteDataDir, filename);

      if (fs.existsSync(filePath) && filename.endsWith(".bin")) {
        const stat = fs.statSync(filePath);
        res.writeHead(200, {
          "Content-Type": "application/octet-stream",
          "Content-Length": stat.size,
        });
        fs.createReadStream(filePath).pipe(res);
        return;
      }

      res.writeHead(404);
      res.end("Not found");
      return;
    }

    // Serve static files (viewer/)
    let filePath = pathname === "/" ? "/index.html" : pathname;
    filePath = path.join(viewerDir, filePath);

    if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
      const ext = path.extname(filePath);
      const contentType = MIME_TYPES[ext] || "application/octet-stream";

      res.writeHead(200, { "Content-Type": contentType });
      fs.createReadStream(filePath).pipe(res);
      return;
    }

    res.writeHead(404);
    res.end("Not found");
  });

  return new Promise((resolve, reject) => {
    server.on("error", reject);
    server.listen(port, () => {
      resolve({
        server,
        url: `http://localhost:${port}`,
      });
    });
  });
}

/**
 * Open browser
 * @param {string} url
 */
export async function openBrowser(url) {
  const { platform } = process;
  const { spawn } = await import("node:child_process");

  const commands = {
    darwin: ["open", [url]],
    win32: ["cmd", ["/c", "start", url]],
    linux: ["xdg-open", [url]],
  };

  const [cmd, args] = commands[platform] || commands.linux;
  spawn(cmd, args, { detached: true, stdio: "ignore" }).unref();
}
