// ── Canvas & Video Setup ────────────────────────────────────────────────────
const video         = document.getElementById('video');
const drawCanvas    = document.getElementById('drawCanvas');
const overlayCanvas = document.getElementById('overlayCanvas');
const drawCtx       = drawCanvas.getContext('2d');
const overlayCtx    = overlayCanvas.getContext('2d');

// ── State ───────────────────────────────────────────────────────────────────
let currentColor = '#ff3b3b';
let brushSize    = 5;
let eraserMode   = false;
let lastX        = null;
let lastY        = null;
let smoothX      = 0;
let smoothY      = 0;
const SMOOTH     = 0.45;
let hintsVisible = true;

// CTRL key draw
let ctrlHeld = false;

// Offscreen canvas — persistent drawing lives here
let offCanvas = document.createElement('canvas');
let offCtx    = offCanvas.getContext('2d');

// Transform state (for move + scale)
let drawOffsetX = 0;
let drawOffsetY = 0;
let drawScale   = 1.0;

// Palm move state
let palmMode       = false;
let palmMoveActive = false;
let palmStartX     = null;
let palmStartY     = null;

// Pinch scale state
let prevPinchDist = null;

// FPS
let lastFrameTime = performance.now();
let frameCount    = 0;
let fps           = 0;

// ── Resize all canvases ──────────────────────────────────────────────────────
function resizeCanvases() {
  const wrapper = drawCanvas.parentElement;
  const w = wrapper.clientWidth;
  const h = wrapper.clientHeight;
  const saved = offCtx.getImageData(0, 0, offCanvas.width, offCanvas.height);
  offCanvas.width  = w;
  offCanvas.height = h;
  [drawCanvas, overlayCanvas].forEach(c => { c.width = w; c.height = h; });
  offCtx.putImageData(saved, 0, 0);
  renderDrawLayer();
}
window.addEventListener('resize', resizeCanvases);

// ── Render offscreen → drawCanvas with transform ─────────────────────────────
function renderDrawLayer() {
  drawCtx.clearRect(0, 0, drawCanvas.width, drawCanvas.height);
  drawCtx.save();
  drawCtx.translate(drawOffsetX, drawOffsetY);
  drawCtx.scale(drawScale, drawScale);
  drawCtx.drawImage(offCanvas, 0, 0);
  drawCtx.restore();
}

// ── Convert landmark to canvas coords ────────────────────────────────────────
// MediaPipe gives x in [0,1].
// The VIDEO is CSS-mirrored (scaleX(-1)) so it looks like a mirror to the user.
// But landmark x=0 is LEFT of the REAL camera (right side on screen due to mirror).
// For drawing: we want x=0 to be LEFT on screen → use (1 - lm.x) * cW
// This way, if you move finger RIGHT on screen, drawing goes RIGHT. Text reads correctly.
function lmToCanvas(lm, cW, cH) {
  return {
    x: (1 - lm.x) * cW,   // un-mirror so drawing matches screen direction
    y: lm.y * cH
  };
}

// ── Finger-up detection ──────────────────────────────────────────────────────
function getFingersUp(landmarks) {
  const tips = [4, 8, 12, 16, 20];
  const pips = [3, 6, 10, 14, 18];
  const up   = [];
  // Thumb: in un-mirrored space, tip.x > pip.x means extended right
  // But since we un-mirror, compare reversed: tip.x < pip.x
  up.push(landmarks[tips[0]].x < landmarks[pips[0]].x);
  for (let i = 1; i < 5; i++) {
    up.push(landmarks[tips[i]].y < landmarks[pips[i]].y);
  }
  return up;
}

// ── Draw stroke on offscreen canvas ─────────────────────────────────────────
function drawStroke(x1, y1, x2, y2) {
  // Convert screen coords → offscreen coords (remove transform)
  const ox1 = (x1 - drawOffsetX) / drawScale;
  const oy1 = (y1 - drawOffsetY) / drawScale;
  const ox2 = (x2 - drawOffsetX) / drawScale;
  const oy2 = (y2 - drawOffsetY) / drawScale;

  offCtx.beginPath();
  offCtx.moveTo(ox1, oy1);
  offCtx.lineTo(ox2, oy2);
  offCtx.strokeStyle = eraserMode ? 'rgba(0,0,0,1)' : currentColor;
  offCtx.lineWidth   = eraserMode ? brushSize * 6 : brushSize;
  offCtx.lineCap     = 'round';
  offCtx.lineJoin    = 'round';
  offCtx.globalCompositeOperation = eraserMode ? 'destination-out' : 'source-over';
  offCtx.stroke();
  offCtx.globalCompositeOperation = 'source-over';
  renderDrawLayer();
}

// ── Finger cursor on overlay ─────────────────────────────────────────────────
function drawCursor(x, y, active, label) {
  overlayCtx.clearRect(0, 0, overlayCanvas.width, overlayCanvas.height);
  const color = palmMode ? '#ffea00' : eraserMode ? '#ffffff' : currentColor;
  const size  = eraserMode ? Math.max(brushSize * 3, 12) : 10;

  overlayCtx.beginPath();
  overlayCtx.arc(x, y, size + 5, 0, Math.PI * 2);
  overlayCtx.strokeStyle = color;
  overlayCtx.lineWidth   = 1.5;
  overlayCtx.globalAlpha = active ? 0.85 : 0.35;
  overlayCtx.stroke();

  overlayCtx.beginPath();
  overlayCtx.arc(x, y, 4, 0, Math.PI * 2);
  overlayCtx.fillStyle   = color;
  overlayCtx.globalAlpha = active ? 1 : 0.5;
  overlayCtx.fill();

  if (label) {
    overlayCtx.globalAlpha = 1;
    overlayCtx.font        = 'bold 13px JetBrains Mono, monospace';
    overlayCtx.fillStyle   = color;
    overlayCtx.strokeStyle = 'rgba(0,0,0,0.6)';
    overlayCtx.lineWidth   = 3;
    overlayCtx.strokeText(label, x + 16, y - 10);
    overlayCtx.fillText(label, x + 16, y - 10);
  }
  overlayCtx.globalAlpha = 1;
}

// ── MediaPipe Results ────────────────────────────────────────────────────────
function onResults(results) {
  frameCount++;
  const now = performance.now();
  if (now - lastFrameTime >= 1000) {
    fps = frameCount; frameCount = 0; lastFrameTime = now;
    document.getElementById('fpsVal').textContent = fps;
  }

  overlayCtx.clearRect(0, 0, overlayCanvas.width, overlayCanvas.height);

  if (!results.multiHandLandmarks || results.multiHandLandmarks.length === 0) {
    document.getElementById('handVal').textContent = 'None';
    lastX = lastY = null;
    palmMode = palmMoveActive = false;
    prevPinchDist = null;
    return;
  }

  document.getElementById('handVal').textContent = 'Detected';

  const lm  = results.multiHandLandmarks[0];
  const up  = getFingersUp(lm);
  const cW  = overlayCanvas.width;
  const cH  = overlayCanvas.height;

  const raw = lmToCanvas(lm[8], cW, cH);
  smoothX = smoothX * (1 - SMOOTH) + raw.x * SMOOTH;
  smoothY = smoothY * (1 - SMOOTH) + raw.y * SMOOTH;
  const cx = smoothX;
  const cy = smoothY;

  const allUp    = up[0] && up[1] && up[2] && up[3] && up[4];
  const twoUp    = up[1] && up[2] && !up[3] && !up[4];
  const oneUp    = up[1] && !up[2] && !up[3] && !up[4];
  const pinchGes = up[0] && up[1] && !up[2] && !up[3] && !up[4];

  // ── PINCH → SCALE ────────────────────────────────────────────────────────
  if (pinchGes) {
    const tp = lmToCanvas(lm[4], cW, cH);
    const ip = lmToCanvas(lm[8], cW, cH);
    const dist = Math.hypot(tp.x - ip.x, tp.y - ip.y);

    if (dist < 80) {
      if (prevPinchDist !== null) {
        const delta = dist - prevPinchDist;
        drawScale = Math.max(0.3, Math.min(5.0, drawScale + delta * 0.012));
        renderDrawLayer();
      }
      prevPinchDist = dist;
      palmMode = palmMoveActive = false;
      lastX = lastY = null;
      drawCursor(cx, cy, true, `${drawScale.toFixed(1)}x`);
      document.getElementById('modeVal').textContent = `Scale ${drawScale.toFixed(1)}x`;
      return;
    }
  }
  prevPinchDist = null;

  // ── ALL 5 UP → PALM MOVE ─────────────────────────────────────────────────
  if (allUp) {
    palmMode   = true;
    eraserMode = false;

    const wrist = lmToCanvas(lm[0], cW, cH);

    if (!palmMoveActive) {
      palmMoveActive = true;
      palmStartX     = wrist.x;
      palmStartY     = wrist.y;
    } else {
      const dx = wrist.x - palmStartX;
      const dy = wrist.y - palmStartY;
      drawOffsetX += dx;
      drawOffsetY += dy;
      palmStartX   = wrist.x;
      palmStartY   = wrist.y;
      renderDrawLayer();
    }

    lastX = lastY = null;
    drawCursor(cx, cy, true, '✋ Move');
    document.getElementById('modeVal').textContent = 'Move';
    return;
  }

  if (palmMode) { palmMode = palmMoveActive = false; }

  // ── 2 FINGERS UP → ERASER ────────────────────────────────────────────────
  if (twoUp) {
    eraserMode = true;
    lastX = lastY = null;
    drawCursor(cx, cy, false, 'Eraser');
    document.getElementById('modeVal').textContent = 'Eraser';
    updateToolUI();
    return;
  }

  // ── 1 FINGER UP OR CTRL → DRAW ───────────────────────────────────────────
  if (oneUp || ctrlHeld) {
    if (oneUp) eraserMode = false;

    if (lastX !== null && lastY !== null) {
      drawStroke(lastX, lastY, cx, cy);
    }
    lastX = cx;
    lastY = cy;
    drawCursor(cx, cy, true, ctrlHeld && !oneUp ? 'CTRL' : null);
    document.getElementById('modeVal').textContent = eraserMode ? 'Eraser' : 'Draw';
    updateToolUI();
    return;
  }

  // ── FIST → PAUSE ─────────────────────────────────────────────────────────
  lastX = lastY = null;
  drawCursor(cx, cy, false, null);
  document.getElementById('modeVal').textContent = 'Paused';
}

// ── MediaPipe Init ────────────────────────────────────────────────────────────
const handsDetector = new Hands({
  locateFile: f => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${f}`
});
handsDetector.setOptions({
  maxNumHands: 1,
  modelComplexity: 1,
  minDetectionConfidence: 0.75,
  minTrackingConfidence: 0.75
});
handsDetector.onResults(onResults);

// ── Camera ────────────────────────────────────────────────────────────────────
const camera = new Camera(video, {
  onFrame: async () => { await handsDetector.send({ image: video }); },
  width: 1280, height: 720
});
camera.start().then(() => {
  document.getElementById('statusDot').classList.add('ready');
  document.getElementById('statusText').textContent = 'Camera ready';
  resizeCanvases();
}).catch(err => {
  document.getElementById('statusDot').classList.add('error');
  document.getElementById('statusText').textContent = 'Camera error — check permissions';
  console.error(err);
});

// ── CTRL key ──────────────────────────────────────────────────────────────────
document.addEventListener('keydown', e => {
  if (e.key === 'Control') ctrlHeld = true;

  switch (e.key.toLowerCase()) {
    case 'c':
      if (!e.ctrlKey) {
        offCtx.clearRect(0, 0, offCanvas.width, offCanvas.height);
        drawOffsetX = 0; drawOffsetY = 0; drawScale = 1.0;
        lastX = lastY = null;
        renderDrawLayer();
      }
      break;
    case 'e': eraserMode = !eraserMode; updateToolUI(); break;
    case 's': if (!e.ctrlKey) saveDrawing(); break;
    case 'h':
      hintsVisible = !hintsVisible;
      document.getElementById('gestureHints').classList.toggle('hidden', !hintsVisible);
      break;
    case '+': case '=':
      brushSize = Math.min(brushSize + 2, 30);
      document.getElementById('brushSize').value = brushSize;
      document.getElementById('brushValue').textContent = brushSize + 'px';
      updateBrushPreview(); break;
    case '-':
      brushSize = Math.max(brushSize - 2, 2);
      document.getElementById('brushSize').value = brushSize;
      document.getElementById('brushValue').textContent = brushSize + 'px';
      updateBrushPreview(); break;
  }
});

document.addEventListener('keyup', e => {
  if (e.key === 'Control') {
    ctrlHeld = false;
    lastX = lastY = null;   // stop stroke on CTRL release
  }
});

// ── Brush preview ─────────────────────────────────────────────────────────────
function updateBrushPreview() {
  const p   = document.getElementById('brushPreview');
  const pCtx = p.getContext('2d');
  pCtx.clearRect(0, 0, 80, 80);
  pCtx.beginPath();
  pCtx.arc(40, 40, Math.min(brushSize, 36), 0, Math.PI * 2);
  pCtx.fillStyle = eraserMode ? '#555' : currentColor;
  pCtx.fill();
}

// ── Color buttons ─────────────────────────────────────────────────────────────
document.querySelectorAll('.color-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.color-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    currentColor = btn.dataset.color;
    eraserMode = false;
    updateToolUI(); updateBrushPreview();
  });
});

// ── Brush slider ──────────────────────────────────────────────────────────────
document.getElementById('brushSize').addEventListener('input', e => {
  brushSize = parseInt(e.target.value);
  document.getElementById('brushValue').textContent = brushSize + 'px';
  updateBrushPreview();
});

// ── Tool buttons ──────────────────────────────────────────────────────────────
document.getElementById('btnDraw').addEventListener('click', () => {
  eraserMode = false; palmMode = false; updateToolUI();
});
document.getElementById('btnEraser').addEventListener('click', () => {
  eraserMode = true; palmMode = false; updateToolUI();
});

function updateToolUI() {
  document.getElementById('btnDraw').classList.toggle('active', !eraserMode && !palmMode);
  document.getElementById('btnEraser').classList.toggle('active', eraserMode);
  if (!palmMode) document.getElementById('modeVal').textContent = eraserMode ? 'Eraser' : 'Draw';
  updateBrushPreview();
}

// ── Action buttons ────────────────────────────────────────────────────────────
document.getElementById('btnClear').addEventListener('click', () => {
  offCtx.clearRect(0, 0, offCanvas.width, offCanvas.height);
  drawOffsetX = 0; drawOffsetY = 0; drawScale = 1.0;
  lastX = lastY = null; renderDrawLayer();
});
document.getElementById('btnSave').addEventListener('click', saveDrawing);
document.getElementById('btnToggleHints').addEventListener('click', () => {
  hintsVisible = !hintsVisible;
  document.getElementById('gestureHints').classList.toggle('hidden', !hintsVisible);
});

// ── Save ──────────────────────────────────────────────────────────────────────
function saveDrawing() {
  const tmp = document.createElement('canvas');
  tmp.width = drawCanvas.width; tmp.height = drawCanvas.height;
  const tCtx = tmp.getContext('2d');
  tCtx.fillStyle = '#000';
  tCtx.fillRect(0, 0, tmp.width, tmp.height);
  tCtx.drawImage(drawCanvas, 0, 0);
  const a = document.createElement('a');
  a.download = `air-draw-${Date.now()}.png`;
  a.href = tmp.toDataURL('image/png');
  a.click();
  showFlash('💾 Saved!');
}

function showFlash(msg) {
  let f = document.querySelector('.flash');
  if (!f) { f = document.createElement('div'); f.className = 'flash'; document.body.appendChild(f); }
  f.textContent = msg;
  f.classList.add('show');
  setTimeout(() => f.classList.remove('show'), 2500);
}

// ── Init ──────────────────────────────────────────────────────────────────────
updateBrushPreview();
