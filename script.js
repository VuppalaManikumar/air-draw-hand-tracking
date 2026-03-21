// ── Canvas & Video Setup ────────────────────────────────────────────────────
const video          = document.getElementById('video');
const drawCanvas     = document.getElementById('drawCanvas');
const overlayCanvas  = document.getElementById('overlayCanvas');
const drawCtx        = drawCanvas.getContext('2d');
const overlayCtx     = overlayCanvas.getContext('2d');

// ── State ───────────────────────────────────────────────────────────────────
let currentColor  = '#ff3b3b';
let brushSize     = 5;
let eraserMode    = false;
let isDrawing     = false;
let lastX         = null;
let lastY         = null;
let smoothX       = 0;
let smoothY       = 0;
const SMOOTH      = 0.45;   // blend factor: higher = more responsive, lower = smoother
let hintsVisible  = true;

// FPS tracking
let lastFrameTime = performance.now();
let frameCount    = 0;
let fps           = 0;

// ── Resize canvases to fill container ───────────────────────────────────────
function resizeCanvases() {
  const wrapper = drawCanvas.parentElement;
  const w = wrapper.clientWidth;
  const h = wrapper.clientHeight;

  // Save drawing before resize
  const imgData = drawCtx.getImageData(0, 0, drawCanvas.width, drawCanvas.height);

  [drawCanvas, overlayCanvas].forEach(c => {
    c.width  = w;
    c.height = h;
  });

  // Restore drawing
  drawCtx.putImageData(imgData, 0, 0);
}

window.addEventListener('resize', resizeCanvases);
resizeCanvases();

// ── Finger-up detection ──────────────────────────────────────────────────────
// Returns array [thumb, index, middle, ring, pinky] true = finger up
function getFingersUp(landmarks) {
  const tips = [4, 8, 12, 16, 20];
  const pips = [3, 6, 10, 14, 18];
  const up   = [];

  // Thumb: x-axis (mirrored camera)
  up.push(landmarks[tips[0]].x < landmarks[pips[0]].x);

  // Other fingers: y-axis
  for (let i = 1; i < 5; i++) {
    up.push(landmarks[tips[i]].y < landmarks[pips[i]].y);
  }
  return up;
}

// ── Draw a smooth line segment ───────────────────────────────────────────────
function drawSegment(x1, y1, x2, y2) {
  drawCtx.beginPath();
  drawCtx.moveTo(x1, y1);
  drawCtx.lineTo(x2, y2);
  drawCtx.strokeStyle = eraserMode ? '#000000' : currentColor;
  drawCtx.lineWidth   = eraserMode ? brushSize * 6 : brushSize;
  drawCtx.lineCap     = 'round';
  drawCtx.lineJoin    = 'round';
  drawCtx.globalCompositeOperation = eraserMode ? 'destination-out' : 'source-over';
  drawCtx.stroke();
  drawCtx.globalCompositeOperation = 'source-over';
}

// ── Draw finger cursor on overlay ────────────────────────────────────────────
function drawCursor(x, y, drawing) {
  overlayCtx.clearRect(0, 0, overlayCanvas.width, overlayCanvas.height);

  const color = eraserMode ? '#ffffff' : currentColor;
  const size  = eraserMode ? brushSize * 3 : 10;

  // Outer ring
  overlayCtx.beginPath();
  overlayCtx.arc(x, y, size + 4, 0, Math.PI * 2);
  overlayCtx.strokeStyle = color;
  overlayCtx.lineWidth   = 1.5;
  overlayCtx.globalAlpha = 0.5;
  overlayCtx.stroke();

  // Inner dot
  overlayCtx.beginPath();
  overlayCtx.arc(x, y, 4, 0, Math.PI * 2);
  overlayCtx.fillStyle   = color;
  overlayCtx.globalAlpha = drawing ? 1 : 0.5;
  overlayCtx.fill();

  overlayCtx.globalAlpha = 1;
}

// ── MediaPipe Results Callback ───────────────────────────────────────────────
function onResults(results) {
  // FPS
  frameCount++;
  const now = performance.now();
  if (now - lastFrameTime >= 1000) {
    fps = frameCount;
    frameCount = 0;
    lastFrameTime = now;
    document.getElementById('fpsVal').textContent = fps;
  }

  overlayCtx.clearRect(0, 0, overlayCanvas.width, overlayCanvas.height);

  if (!results.multiHandLandmarks || results.multiHandLandmarks.length === 0) {
    document.getElementById('handVal').textContent = 'None';
    lastX = lastY = null;
    return;
  }

  document.getElementById('handVal').textContent = 'Detected';

  const landmarks = results.multiHandLandmarks[0];
  const up        = getFingersUp(landmarks);
  const cW        = overlayCanvas.width;
  const cH        = overlayCanvas.height;

  // Raw index fingertip position (mirrored)
  const rawX = landmarks[8].x * cW;
  const rawY = landmarks[8].y * cH;

  // Exponential smoothing
  smoothX = smoothX * (1 - SMOOTH) + rawX * SMOOTH;
  smoothY = smoothY * (1 - SMOOTH) + rawY * SMOOTH;
  const cx = smoothX;
  const cy = smoothY;

  // ── Gesture logic ──────────────────────────────────────────────────────────

  // All 5 fingers up → CLEAR
  if (up[0] && up[1] && up[2] && up[3] && up[4]) {
    drawCtx.clearRect(0, 0, drawCanvas.width, drawCanvas.height);
    lastX = lastY = null;
    showGestureLabel('✋ Cleared!');

  // 2 fingers up (index + middle) → ERASER mode
  } else if (up[1] && up[2] && !up[3] && !up[4]) {
    if (!eraserMode) {
      eraserMode = true;
      updateToolUI();
    }
    lastX = lastY = null;
    drawCursor(cx, cy, false);

  // 1 finger up (index only) → DRAW
  } else if (up[1] && !up[2] && !up[3] && !up[4]) {
    if (lastX !== null && lastY !== null) {
      drawSegment(lastX, lastY, cx, cy);
    }
    lastX = cx;
    lastY = cy;
    drawCursor(cx, cy, true);

  // Fist → PAUSE
  } else {
    lastX = lastY = null;
    drawCursor(cx, cy, false);
  }

  document.getElementById('modeVal').textContent = eraserMode ? 'Eraser' : 'Draw';
}

// ── MediaPipe Hands Setup ────────────────────────────────────────────────────
const handsDetector = new Hands({
  locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`
});

handsDetector.setOptions({
  maxNumHands: 1,
  modelComplexity: 1,
  minDetectionConfidence: 0.75,
  minTrackingConfidence: 0.75
});

handsDetector.onResults(onResults);

// ── Camera ───────────────────────────────────────────────────────────────────
const camera = new Camera(video, {
  onFrame: async () => {
    await handsDetector.send({ image: video });
  },
  width: 1280,
  height: 720
});

camera.start().then(() => {
  document.getElementById('statusDot').classList.add('ready');
  document.getElementById('statusText').textContent = 'Camera ready';
}).catch(err => {
  document.getElementById('statusDot').classList.add('error');
  document.getElementById('statusText').textContent = 'Camera error — check permissions';
  console.error(err);
});

// ── Brush Preview ────────────────────────────────────────────────────────────
function updateBrushPreview() {
  const preview = document.getElementById('brushPreview');
  const pCtx    = preview.getContext('2d');
  pCtx.clearRect(0, 0, 80, 80);
  pCtx.beginPath();
  pCtx.arc(40, 40, brushSize, 0, Math.PI * 2);
  pCtx.fillStyle = eraserMode ? '#555' : currentColor;
  pCtx.fill();
}

// ── Color Buttons ────────────────────────────────────────────────────────────
document.querySelectorAll('.color-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.color-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    currentColor = btn.dataset.color;
    eraserMode   = false;
    updateToolUI();
    updateBrushPreview();
  });
});

// ── Brush Slider ─────────────────────────────────────────────────────────────
document.getElementById('brushSize').addEventListener('input', (e) => {
  brushSize = parseInt(e.target.value);
  document.getElementById('brushValue').textContent = brushSize + 'px';
  updateBrushPreview();
});

// ── Tool Buttons ──────────────────────────────────────────────────────────────
document.getElementById('btnDraw').addEventListener('click', () => {
  eraserMode = false;
  updateToolUI();
});

document.getElementById('btnEraser').addEventListener('click', () => {
  eraserMode = true;
  updateToolUI();
});

function updateToolUI() {
  document.getElementById('btnDraw').classList.toggle('active', !eraserMode);
  document.getElementById('btnEraser').classList.toggle('active', eraserMode);
  document.getElementById('modeVal').textContent = eraserMode ? 'Eraser' : 'Draw';
  updateBrushPreview();
}

// ── Action Buttons ────────────────────────────────────────────────────────────
document.getElementById('btnClear').addEventListener('click', () => {
  drawCtx.clearRect(0, 0, drawCanvas.width, drawCanvas.height);
  lastX = lastY = null;
});

document.getElementById('btnSave').addEventListener('click', saveDrawing);

document.getElementById('btnToggleHints').addEventListener('click', () => {
  hintsVisible = !hintsVisible;
  document.getElementById('gestureHints').classList.toggle('hidden', !hintsVisible);
});

// ── Save Drawing ──────────────────────────────────────────────────────────────
function saveDrawing() {
  // Composite: black bg + drawing
  const tempCanvas = document.createElement('canvas');
  tempCanvas.width  = drawCanvas.width;
  tempCanvas.height = drawCanvas.height;
  const tCtx = tempCanvas.getContext('2d');
  tCtx.fillStyle = '#000000';
  tCtx.fillRect(0, 0, tempCanvas.width, tempCanvas.height);
  tCtx.drawImage(drawCanvas, 0, 0);

  const link      = document.createElement('a');
  link.download   = `air-draw-${Date.now()}.png`;
  link.href       = tempCanvas.toDataURL('image/png');
  link.click();
  showFlash('Drawing saved!');
}

// ── Flash Message ─────────────────────────────────────────────────────────────
function showFlash(msg) {
  let flash = document.querySelector('.flash');
  if (!flash) {
    flash = document.createElement('div');
    flash.className = 'flash';
    document.body.appendChild(flash);
  }
  flash.textContent = msg;
  flash.classList.add('show');
  setTimeout(() => flash.classList.remove('show'), 2500);
}

function showGestureLabel(msg) {
  showFlash(msg);
}

// ── Keyboard Shortcuts ────────────────────────────────────────────────────────
document.addEventListener('keydown', (e) => {
  switch (e.key.toLowerCase()) {
    case 'c':
      drawCtx.clearRect(0, 0, drawCanvas.width, drawCanvas.height);
      lastX = lastY = null;
      break;
    case 'e':
      eraserMode = !eraserMode;
      updateToolUI();
      break;
    case 's':
      saveDrawing();
      break;
    case 'h':
      hintsVisible = !hintsVisible;
      document.getElementById('gestureHints').classList.toggle('hidden', !hintsVisible);
      break;
    case '+':
    case '=':
      brushSize = Math.min(brushSize + 2, 30);
      document.getElementById('brushSize').value = brushSize;
      document.getElementById('brushValue').textContent = brushSize + 'px';
      updateBrushPreview();
      break;
    case '-':
      brushSize = Math.max(brushSize - 2, 2);
      document.getElementById('brushSize').value = brushSize;
      document.getElementById('brushValue').textContent = brushSize + 'px';
      updateBrushPreview();
      break;
  }
});

// ── Init ──────────────────────────────────────────────────────────────────────
updateBrushPreview();
