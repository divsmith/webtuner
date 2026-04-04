/**
 * asciiTuner.js — Fluid ASCII art tuner display
 *
 * Renders the detected note as an ASCII art letter shape with concentric ring
 * waves emanating outward. Uses @chenglou/pretext for character width measurement
 * to build a brightness-sorted palette, similar to the fluid-smoke demo.
 */

import { prepareWithSegments } from '@chenglou/pretext';
import { getShapeMask, scaleShape } from './noteShapes.js';

// ── Configuration ────────────────────────────────────────────
const FONT_SIZE      = 14;
const LINE_HEIGHT    = 17;
const PROP_FAMILY    = 'Georgia, Palatino, "Times New Roman", serif';
const CHARSET        = ' .,:;!+-=*#@%&abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789~(){}[]|/\\<>';
const WEIGHTS        = [300, 500, 800];
const FONT_STYLES    = ['normal', 'italic'];
const MAX_COLS       = 160;
const MAX_ROWS       = 60;
const MAX_CENTS      = 50;
const IN_TUNE_CENTS  = 3;
const SHAPE_SCALE    = 3;

// Letter body envelope
const LETTER_ATTACK       = 0.055; // rise rate per frame  (~18 frames to full)
const LETTER_RELEASE      = 0.035; // fall rate per frame  (~28 frames to fade out)

// Smooth color interpolation
const COLOR_LERP_RATE     = 0.045; // lerp rate per frame  (~22 frames to settle)

// Ring wave parameters
const RING_SPEED          = 0.35;  // cells per frame
const RING_EMIT_INTERVAL  = 4;     // frames between new rings
const RING_MAX_RADIUS     = 35;    // max travel distance
const RING_WIDTH          = 3.5;   // half-width of each ring band (cells)
const RING_DECAY          = 0.012; // brightness lost per cell of travel
const MAX_WAVE_DENSITY    = 0.55;  // cap wave brightness well below letter body
const DENSITY_FADE        = 0.91;  // global density multiplier per frame

// Peak-hold envelope for sustained ring emission after pluck
const PEAK_ATTACK         = 1.0;   // instant attack
const PEAK_RELEASE        = 0.985; // slow exponential decay per frame
let peakVolume            = 0;

// ── Palette ──────────────────────────────────────────────────
let palette = [];
let avgCharW = 8;
let spaceW   = 4;
let paletteReady = false;

// Canvas for brightness estimation
const bCvs = document.createElement('canvas');
bCvs.width = bCvs.height = 28;
const bCtx = bCvs.getContext('2d', { willReadFrequently: true });

function estimateBrightness(ch, font) {
  bCtx.clearRect(0, 0, 28, 28);
  bCtx.font = font;
  bCtx.fillStyle = '#fff';
  bCtx.textBaseline = 'middle';
  bCtx.fillText(ch, 1, 14);
  const d = bCtx.getImageData(0, 0, 28, 28).data;
  let sum = 0;
  for (let i = 3; i < d.length; i += 4) sum += d[i];
  return sum / (255 * 784);
}

function buildPalette() {
  palette = [];
  for (const style of FONT_STYLES) {
    for (const weight of WEIGHTS) {
      const font = `${style === 'italic' ? 'italic ' : ''}${weight} ${FONT_SIZE}px ${PROP_FAMILY}`;
      for (const ch of CHARSET) {
        if (ch === ' ') continue;
        const p = prepareWithSegments(ch, font);
        const width = p.widths.length > 0 ? p.widths[0] : 0;
        if (width <= 0) continue;
        palette.push({ char: ch, weight, style, font, width, brightness: estimateBrightness(ch, font) });
      }
    }
  }

  const maxB = Math.max(...palette.map(p => p.brightness));
  if (maxB > 0) {
    for (const p of palette) p.brightness /= maxB;
  }

  palette.sort((a, b) => a.brightness - b.brightness);
  avgCharW = palette.reduce((s, p) => s + p.width, 0) / (palette.length || 1);
  spaceW = FONT_SIZE * 0.27;
  paletteReady = true;
}

function findBest(targetB, targetW) {
  let lo = 0, hi = palette.length - 1;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (palette[mid].brightness < targetB) lo = mid + 1;
    else hi = mid;
  }
  let bestScore = Infinity, best = palette[lo] || palette[0];
  const searchStart = Math.max(0, lo - 15);
  const searchEnd = Math.min(palette.length, lo + 15);
  for (let i = searchStart; i < searchEnd; i++) {
    const p = palette[i];
    const score = Math.abs(p.brightness - targetB) * 2.5 + Math.abs(p.width - targetW) / targetW;
    if (score < bestScore) { bestScore = score; best = p; }
  }
  return best;
}

// ── Color interpolation ──────────────────────────────────────
// 10 brightness levels × color from tuning state
const COLOR_STOPS = {
  red:    { r: 232, g: 84,  b: 84  },
  yellow: { r: 240, g: 192, b: 64  },
  green:  { r: 45,  g: 206, b: 114 },
};

function getTuneColor(cents) {
  const absCents = Math.abs(cents);
  if (absCents <= IN_TUNE_CENTS) return COLOR_STOPS.green;
  if (absCents >= 30) return COLOR_STOPS.red;

  // Interpolate
  if (absCents <= 15) {
    const t = (absCents - IN_TUNE_CENTS) / (15 - IN_TUNE_CENTS);
    return lerpColor(COLOR_STOPS.green, COLOR_STOPS.yellow, t);
  }
  const t = (absCents - 15) / (30 - 15);
  return lerpColor(COLOR_STOPS.yellow, COLOR_STOPS.red, t);
}

function lerpColor(a, b, t) {
  return {
    r: Math.round(a.r + (b.r - a.r) * t),
    g: Math.round(a.g + (b.g - a.g) * t),
    b: Math.round(a.b + (b.b - a.b) * t),
  };
}

function colorString(color, alpha) {
  return `rgba(${color.r},${color.g},${color.b},${alpha.toFixed(2)})`;
}

// ── HTML helpers ─────────────────────────────────────────────
function esc(c) {
  if (c === '&') return '&amp;';
  if (c === '<') return '&lt;';
  if (c === '>') return '&gt;';
  return c;
}

function weightClass(w, s) {
  const wc = w === 300 ? 'w3' : w === 500 ? 'w5' : 'w8';
  return s === 'italic' ? wc + ' it' : wc;
}

// ── Grid state ───────────────────────────────────────────────
let container = null;
let cols = 0;
let rows = 0;
let rowEls = [];
let waveDensity;   // wave-only density field (never contains letter body)
let isShapeCell;   // boolean mask: true for cells that are part of the letter
let cellPhase;     // Float32Array of per-cell random phase offsets for body animation
let running = false;
let visible = false;
let rafId = null;
let resizeObserver = null;

// ── Tuning state (set externally) ────────────────────────────
let currentNote   = null;
let currentCents  = 0;
let currentVolume = 0;
let currentInTune = false;

// ── Letter body & color animation state ──────────────────────
let letterBodyAlpha = 0;                          // 0 = invisible, 1 = fully visible
let displayColor    = { r: 45, g: 206, b: 114 }; // lerp'd toward getTuneColor each frame

// ── Ring wave state ──────────────────────────────────────────
let rings = [];
let frameCount = 0;
let shapeMask = null;
let shapeOffsetCol = 0;
let shapeOffsetRow = 0;
let shapeW = 0;
let shapeH = 0;
// Signed distance from shape boundary, precomputed
let shapeDist = null;

function computeShapeLayout() {
  if (!currentNote) {
    shapeMask = null;
    shapeDist = null;
    return;
  }

  const raw = getShapeMask(currentNote);
  if (!raw) {
    shapeMask = null;
    shapeDist = null;
    return;
  }

  const scaled = scaleShape(raw, SHAPE_SCALE);
  shapeMask = scaled;
  shapeW = scaled.width;
  shapeH = scaled.height;

  // Center the shape vertically, offset horizontally by cents
  shapeOffsetRow = Math.max(0, Math.floor((rows - shapeH) / 2));

  // Horizontal: center ± cents-based offset
  const centerCol = Math.floor((cols - shapeW) / 2);
  const maxShift = Math.floor(cols * 0.3);
  let centsOffset = 0;
  if (Math.abs(currentCents) > IN_TUNE_CENTS) {
    const sign = currentCents > 0 ? 1 : -1;
    const magnitude = Math.min(Math.abs(currentCents), MAX_CENTS);
    const normalized = (magnitude - IN_TUNE_CENTS) / (MAX_CENTS - IN_TUNE_CENTS);
    centsOffset = Math.round(sign * normalized * maxShift);
  }
  shapeOffsetCol = Math.max(0, Math.min(cols - shapeW, centerCol + centsOffset));

  // Precompute distance field from shape boundary
  shapeDist = new Float32Array(cols * rows);
  shapeDist.fill(999);

  // Mark shape interior as 0, then BFS outward
  const queue = [];
  for (let r = 0; r < shapeH; r++) {
    for (let c = 0; c < shapeW; c++) {
      const gr = shapeOffsetRow + r;
      const gc = shapeOffsetCol + c;
      if (gr < rows && gc < cols && scaled.grid[r][c]) {
        shapeDist[gr * cols + gc] = 0;
        queue.push(gr * cols + gc);
      }
    }
  }

  // Simple BFS distance
  let head = 0;
  while (head < queue.length) {
    const idx = queue[head++];
    const r = (idx / cols) | 0;
    const c = idx % cols;
    const d = shapeDist[idx] + 1;
    const neighbors = [
      [r - 1, c], [r + 1, c], [r, c - 1], [r, c + 1],
    ];
    for (const [nr, nc] of neighbors) {
      if (nr >= 0 && nr < rows && nc >= 0 && nc < cols) {
        const ni = nr * cols + nc;
        if (d < shapeDist[ni]) {
          shapeDist[ni] = d;
          queue.push(ni);
        }
      }
    }
  }
}

// ── Ring management ──────────────────────────────────────────
function updatePeakEnvelope() {
  if (currentVolume > peakVolume) {
    peakVolume = currentVolume;
  } else {
    peakVolume *= PEAK_RELEASE;
  }
}

function emitRing() {
  if (!shapeMask) return;
  if (peakVolume < 0.002) return;

  rings.push({
    radius: 0,
    brightness: Math.min(MAX_WAVE_DENSITY, peakVolume * 3),
  });
}

function stepRings() {
  for (let i = rings.length - 1; i >= 0; i--) {
    const ring = rings[i];
    ring.radius += RING_SPEED;
    ring.brightness -= RING_DECAY;
    if (ring.brightness <= 0 || ring.radius > RING_MAX_RADIUS) {
      rings.splice(i, 1);
    }
  }
}

function ringsContributionAt(dist) {
  let total = 0;
  for (const ring of rings) {
    const delta = Math.abs(dist - ring.radius);
    if (delta < RING_WIDTH) {
      const falloff = 1 - delta / RING_WIDTH;
      // Smooth falloff curve
      total += ring.brightness * falloff * falloff;
    }
  }
  return Math.min(MAX_WAVE_DENSITY, total);
}

// ── Grid setup ───────────────────────────────────────────────
function initGrid() {
  if (!container) return;

  const rect = container.getBoundingClientRect();
  if (rect.width < 1 || rect.height < 1) return; // hidden — skip until visible

  cols = Math.min(MAX_COLS, Math.max(10, Math.floor(rect.width / avgCharW)));
  rows = Math.min(MAX_ROWS, Math.max(5, Math.floor(rect.height / LINE_HEIGHT)));

  waveDensity = new Float32Array(cols * rows);
  isShapeCell = new Uint8Array(cols * rows);

  // Per-cell random phase offsets for the animated body shimmer
  cellPhase = new Float32Array(cols * rows);
  for (let i = 0; i < cellPhase.length; i++) {
    cellPhase[i] = Math.random() * Math.PI * 2;
  }

  letterBodyAlpha = 0;
  container.innerHTML = '';
  rowEls = [];

  for (let r = 0; r < rows; r++) {
    const div = document.createElement('div');
    div.className = 'asc-row';
    div.style.height = div.style.lineHeight = LINE_HEIGHT + 'px';
    container.appendChild(div);
    rowEls.push(div);
  }

  rings = [];
  frameCount = 0;
  peakVolume = 0;
  computeShapeLayout();
}

// ── Simulation step ──────────────────────────────────────────
function simulate() {
  const n = cols * rows;

  // Track volume envelope every frame
  updatePeakEnvelope();

  // Fade wave density only (letter body is handled separately)
  for (let i = 0; i < n; i++) {
    waveDensity[i] *= DENSITY_FADE;
  }

  // Recompute shape cell mask
  isShapeCell.fill(0);
  if (shapeMask) {
    for (let r = 0; r < shapeH; r++) {
      for (let c = 0; c < shapeW; c++) {
        if (shapeMask.grid[r][c]) {
          const gr = shapeOffsetRow + r;
          const gc = shapeOffsetCol + c;
          if (gr < rows && gc < cols) {
            isShapeCell[gr * cols + gc] = 1;
          }
        }
      }
    }
  }

  // Emit new rings periodically
  if (frameCount % RING_EMIT_INTERVAL === 0) {
    emitRing();
  }
  stepRings();

  // Apply ring contributions ONLY to cells outside the letter shape
  if (shapeDist && rings.length > 0) {
    for (let i = 0; i < n; i++) {
      if (isShapeCell[i]) continue; // protect letter body
      const dist = shapeDist[i];
      if (dist > 0 && dist < RING_MAX_RADIUS) {
        const contrib = ringsContributionAt(dist);
        if (contrib > waveDensity[i]) {
          waveDensity[i] = contrib;
        }
      }
    }
  }

  // Update letter body alpha envelope
  if (currentNote && peakVolume > 0.005) {
    letterBodyAlpha = Math.min(1.0, letterBodyAlpha + LETTER_ATTACK);
  } else {
    letterBodyAlpha = Math.max(0.0, letterBodyAlpha - LETTER_RELEASE);
  }

  // Smooth color interpolation toward the current tuning target
  displayColor = lerpColor(displayColor, getTuneColor(currentCents), COLOR_LERP_RATE);

  frameCount++;
}

// ── Render ───────────────────────────────────────────────────
function render() {
  if (!running) return;
  rafId = requestAnimationFrame(render);
  if (!visible || !paletteReady || cols === 0) return;

  simulate();

  const color = displayColor;
  const targetCellW = container.getBoundingClientRect().width / cols;

  for (let r = 0; r < rows; r++) {
    let html = '';
    for (let c = 0; c < cols; c++) {
      const idx = r * cols + c;

      if (isShapeCell[idx]) {
        if (letterBodyAlpha < 0.01) {
          html += ' ';
        } else {
          // Animated body: each cell independently cycles brightness via a slow sine,
          // making the letter shimmer with continuously changing ASCII characters.
          const phase = cellPhase[idx];
          const bodyB = 0.72 + 0.28 * Math.sin(frameCount * 0.07 + phase);
          const m = findBest(bodyB, targetCellW);
          const clr = colorString(color, letterBodyAlpha);
          const cls = weightClass(m.weight, m.style);
          html += `<span class="${cls}" style="color:${clr}">${esc(m.char)}</span>`;
        }
      } else {
        const b = waveDensity[idx];
        if (b < 0.02) {
          html += ' ';
        } else {
          const m = findBest(b, targetCellW);
          const alpha = Math.max(0.08, Math.min(0.85, b));
          const clr = colorString(color, alpha);
          const cls = weightClass(m.weight, m.style);
          html += `<span class="${cls}" style="color:${clr}">${esc(m.char)}</span>`;
        }
      }
    }
    rowEls[r].innerHTML = html;
  }
}

// ── Public API ───────────────────────────────────────────────

/**
 * Initialize the ASCII tuner. Builds the character palette (one-time cost)
 * and prepares the grid. Call start() to begin rendering.
 * @param {HTMLElement} el - The container element (#ascii-tuner)
 */
export function init(el) {
  if (!el) return;
  container = el;

  if (!bCtx) {
    // Canvas 2D not available — degrade silently
    return;
  }

  buildPalette();

  // Use ResizeObserver to rebuild grid when container becomes visible or resizes
  if (typeof ResizeObserver !== 'undefined') {
    resizeObserver = new ResizeObserver(() => {
      initGrid();
    });
    resizeObserver.observe(container);
  }
}

/**
 * Start the render loop. Call after the tuner container is visible.
 */
export function start() {
  if (running) return;
  visible = true;
  running = true;
  initGrid();
  rafId = requestAnimationFrame(render);
}

/**
 * Pause the render loop (e.g. when switching to start/error screen).
 */
export function stop() {
  running = false;
  visible = false;
  if (rafId) cancelAnimationFrame(rafId);
  rafId = null;
}

let resizeTimer = 0;
function handleResize() {
  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(initGrid, 150);
}

/**
 * Update the displayed tuning state.
 * @param {string|null} noteName - Note name like "E", "F#", "Bb", or null for silence
 * @param {number} cents - Deviation in cents from target (positive = sharp)
 * @param {number} volume - Current RMS volume (0–1 range, typically 0–0.3)
 * @param {boolean} inTune - Whether the note is within the in-tune threshold
 */
export function setTuningState(noteName, cents, volume, inTune) {
  const noteChanged = noteName !== currentNote;
  currentNote = noteName;
  currentCents = isFinite(cents) ? cents : 0;
  currentVolume = isFinite(volume) ? volume : 0;
  currentInTune = inTune;

  if (noteChanged) {
    letterBodyAlpha = 0;  // reset so the new note emerges from zero
    computeShapeLayout();
  } else if (shapeMask) {
    // Recompute horizontal offset for cents changes
    const centerCol = Math.floor((cols - shapeW) / 2);
    const maxShift = Math.floor(cols * 0.3);
    let centsOffset = 0;
    if (Math.abs(currentCents) > IN_TUNE_CENTS) {
      const sign = currentCents > 0 ? 1 : -1;
      const magnitude = Math.min(Math.abs(currentCents), MAX_CENTS);
      const normalized = (magnitude - IN_TUNE_CENTS) / (MAX_CENTS - IN_TUNE_CENTS);
      centsOffset = Math.round(sign * normalized * maxShift);
    }
    const newOffset = Math.max(0, Math.min(cols - shapeW, centerCol + centsOffset));
    if (newOffset !== shapeOffsetCol) {
      shapeOffsetCol = newOffset;
      computeShapeLayout();
    }
  }
}

/**
 * Stop the render loop and clean up.
 */
export function destroy() {
  running = false;
  visible = false;
  if (rafId) cancelAnimationFrame(rafId);
  rafId = null;
  if (resizeObserver) {
    resizeObserver.disconnect();
    resizeObserver = null;
  }
  clearTimeout(resizeTimer);
  if (container) container.innerHTML = '';
}
