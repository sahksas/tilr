/**
 * Tile Animation Viewer
 * A simple Canvas2D-based viewer
 */

// CADF decoder (inline definition for browser compatibility)
// Supports version 1 (legacy) and version 2 (large frames)
function decodeCADF(arrayBuffer) {
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
    throw new Error(`Invalid format. Expected CADF, got ${magic}`);
  }

  const version = view.getUint16(offset, true);
  offset += 2;

  if (version > 2) {
    throw new Error(`Unsupported version: ${version}`);
  }

  const frameCount = view.getUint16(offset, true);
  offset += 2;

  const frames = [];

  // First frame (complete data)
  const firstFrameNumber = view.getUint16(offset, true);
  offset += 2;

  // Version 2 uses UInt32 for point count
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

  // Subsequent frames (diffs)
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

    const prevCoordinates = [...frames[i - 1].coordinates];

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

    removedIndices.sort((a, b) => b - a);
    for (const index of removedIndices) {
      prevCoordinates.splice(index, 1);
    }

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

// Application state
const state = {
  frames: [],
  currentFrame: 0,
  isPlaying: false,
  animationId: null,
  lastTime: 0,
  tileSize: 8,
  tileColor: "#4a9eff",
  bgColor: "#0a0a1a",
  fps: 15,
  gridWidth: 0,
  gridHeight: 0,
};

// DOM elements
const canvas = document.getElementById("canvas");
const ctx = canvas.getContext("2d");
const playBtn = document.getElementById("play-btn");
const menuBtn = document.getElementById("menu-btn");
const menuPopup = document.getElementById("menu-popup");
const seekbar = document.getElementById("seekbar");
const seekbarContainer = document.getElementById("seekbar-container");
const frameInfo = document.getElementById("frame-info");
const status = document.getElementById("status");
const tileSizeInput = document.getElementById("tile-size");
const tileColorInput = document.getElementById("tile-color");
const bgColorInput = document.getElementById("bg-color");
const fpsInput = document.getElementById("fps-input");

/**
 * Render a frame
 */
function renderFrame(frameIndex) {
  if (frameIndex < 0 || frameIndex >= state.frames.length) return;

  const frame = state.frames[frameIndex];
  const tileSize = state.tileSize;
  const gap = 1;
  const fullSize = tileSize + gap;

  // Clear canvas
  ctx.fillStyle = state.bgColor;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Draw tiles
  ctx.fillStyle = state.tileColor;
  for (const [x, y] of frame.coordinates) {
    ctx.fillRect(x * fullSize, y * fullSize, tileSize, tileSize);
  }

  // Update info
  frameInfo.textContent = `Frame: ${frameIndex + 1} / ${state.frames.length} (${frame.totalPoints} points)`;
  seekbar.value = frameIndex;
  state.currentFrame = frameIndex;
}

/**
 * Animation loop
 */
function animate(timestamp) {
  if (!state.isPlaying) return;

  const frameInterval = 1000 / state.fps;
  const elapsed = timestamp - state.lastTime;

  if (elapsed >= frameInterval) {
    state.lastTime = timestamp - (elapsed % frameInterval);
    state.currentFrame = (state.currentFrame + 1) % state.frames.length;
    renderFrame(state.currentFrame);
  }

  state.animationId = requestAnimationFrame(animate);
}

/**
 * Toggle play/pause
 */
function togglePlay() {
  if (state.frames.length === 0) return;

  state.isPlaying = !state.isPlaying;
  playBtn.textContent = state.isPlaying ? "⏸" : "▶";

  if (state.isPlaying) {
    state.lastTime = performance.now();
    state.animationId = requestAnimationFrame(animate);
  } else {
    cancelAnimationFrame(state.animationId);
  }
}

/**
 * Calculate max coordinates from all frames
 */
function calculateMaxCoordinates(frames) {
  let maxX = 0;
  let maxY = 0;
  for (const frame of frames) {
    for (const [x, y] of frame.coordinates) {
      if (x > maxX) maxX = x;
      if (y > maxY) maxY = y;
    }
  }
  return { maxX, maxY };
}

/**
 * Calculate optimal tile size to fit in viewport
 */
function calculateOptimalTileSize(maxX, maxY) {
  const gap = 1;
  const maxWidth = Math.min(800, window.innerWidth);
  const maxHeight = window.innerHeight;
  // (maxX + 1) * (tileSize + gap) should fit in width
  // (maxY + 1) * (tileSize + gap) should fit in height
  const tileSizeByWidth = Math.floor(maxWidth / (maxX + 1)) - gap;
  const tileSizeByHeight = Math.floor(maxHeight / (maxY + 1)) - gap;
  // Use the minimum that fits both, at least 1px
  return Math.max(1, Math.min(tileSizeByWidth, tileSizeByHeight));
}

/**
 * Update canvas size based on grid size and tile size
 */
function updateCanvasSize() {
  if (state.gridWidth === 0 || state.gridHeight === 0) return;
  const gap = 1;
  const fullSize = state.tileSize + gap;

  // Logical size (render resolution)
  canvas.width = state.gridWidth * fullSize;
  canvas.height = state.gridHeight * fullSize;
  // Display size is controlled by CSS
}

// Event listeners
playBtn.addEventListener("click", togglePlay);

// Menu button
menuBtn.addEventListener("click", () => {
  menuPopup.classList.toggle("visible");
});

// Close menu on outside click
document.addEventListener("click", (e) => {
  if (!menuPopup.contains(e.target) && e.target !== menuBtn) {
    menuPopup.classList.remove("visible");
  }
});

seekbar.addEventListener("input", (e) => {
  if (state.isPlaying) {
    togglePlay(); // Pause
  }
  renderFrame(parseInt(e.target.value));
});

tileSizeInput.addEventListener("change", (e) => {
  state.tileSize = parseInt(e.target.value) || 8;
  updateCanvasSize();
  renderFrame(state.currentFrame);
});

tileColorInput.addEventListener("input", (e) => {
  state.tileColor = e.target.value;
  renderFrame(state.currentFrame);
});

bgColorInput.addEventListener("input", (e) => {
  state.bgColor = e.target.value;
  document.body.style.background = e.target.value;
  renderFrame(state.currentFrame);
});

fpsInput.addEventListener("change", (e) => {
  state.fps = parseInt(e.target.value) || 15;
});

// Wheel control
seekbar.addEventListener("wheel", (e) => {
  e.preventDefault();
  if (state.frames.length === 0) return;
  const delta = e.deltaY > 0 ? 1 : -1;
  const newFrame = Math.max(0, Math.min(state.frames.length - 1, state.currentFrame + delta));
  if (state.isPlaying) togglePlay();
  renderFrame(newFrame);
});

tileSizeInput.addEventListener("wheel", (e) => {
  e.preventDefault();
  const delta = e.deltaY > 0 ? -1 : 1;
  const newValue = Math.max(1, Math.min(32, state.tileSize + delta));
  state.tileSize = newValue;
  tileSizeInput.value = newValue;
  updateCanvasSize();
  renderFrame(state.currentFrame);
});

fpsInput.addEventListener("wheel", (e) => {
  e.preventDefault();
  const delta = e.deltaY > 0 ? -1 : 1;
  const newValue = Math.max(1, Math.min(60, state.fps + delta));
  state.fps = newValue;
  fpsInput.value = newValue;
});

// Recalculate tile size on window resize
window.addEventListener("resize", () => {
  if (state.gridWidth === 0 || state.gridHeight === 0) return;
  const optimalTileSize = calculateOptimalTileSize(state.gridWidth - 1, state.gridHeight - 1);
  state.tileSize = optimalTileSize;
  tileSizeInput.value = optimalTileSize;
  updateCanvasSize();
  renderFrame(state.currentFrame);
});

// Keyboard shortcuts
document.addEventListener("keydown", (e) => {
  if (e.code === "Space") {
    e.preventDefault();
    togglePlay();
  } else if (e.code === "ArrowLeft" && !state.isPlaying) {
    renderFrame(Math.max(0, state.currentFrame - 1));
  } else if (e.code === "ArrowRight" && !state.isPlaying) {
    renderFrame(Math.min(state.frames.length - 1, state.currentFrame + 1));
  }
});

/**
 * Auto-load bin files from API
 */
async function autoLoadFromAPI() {
  try {
    const response = await fetch("/api/files");
    if (!response.ok) {
      return false;
    }

    const { files } = await response.json();
    if (!files || files.length === 0) {
      return false;
    }

    status.textContent = `Loading ${files.length} file(s) from server...`;

    // Fetch and load bin files
    const sortedFiles = files.sort();
    state.frames = [];

    for (const filename of sortedFiles) {
      const binResponse = await fetch(`/data/${filename}`);
      if (!binResponse.ok) {
        throw new Error(`Failed to load ${filename}`);
      }

      const arrayBuffer = await binResponse.arrayBuffer();
      const frames = decodeCADF(arrayBuffer);
      state.frames.push(...frames);
      status.textContent = `Loaded: ${state.frames.length} frames`;
    }

    // Update UI
    if (state.frames.length > 0) {
      // Calculate grid size
      const { maxX, maxY } = calculateMaxCoordinates(state.frames);
      state.gridWidth = maxX + 1;
      state.gridHeight = maxY + 1;

      // Auto-calculate tile size
      const optimalTileSize = calculateOptimalTileSize(maxX, maxY);
      state.tileSize = optimalTileSize;
      tileSizeInput.value = optimalTileSize;

      // Update canvas size
      updateCanvasSize();

      seekbar.max = state.frames.length - 1;
      playBtn.disabled = false;
      state.currentFrame = 0;
      renderFrame(0);

      // Show UI
      seekbarContainer.classList.add("visible");
      frameInfo.classList.add("visible");

      status.textContent = `Loaded ${sortedFiles.length} file(s), ${state.frames.length} total frames (density: ${optimalTileSize}, grid: ${state.gridWidth}x${state.gridHeight})`;
    }

    return true;
  } catch (err) {
    console.log("API not available or failed:", err.message);
    return false;
  }
}

// Initialize
(async () => {
  const loaded = await autoLoadFromAPI();
  if (!loaded) {
    status.textContent = "No animation data found. Use 'npx tilr view <dir>' to start.";
  }
})();
