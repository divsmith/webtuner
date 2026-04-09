/**
 * tunerDisplay.js — Classic arc needle meter + note name display
 *
 * Renders a standard chromatic-tuner UI:
 *   - Large note name (e.g. "E♭") centred above the meter
 *   - Small cents readout below the note name
 *   - SVG half-circle arc with a rotating needle
 *     (needle at 12 o'clock = in tune; ±80° = ±50 cents)
 *   - Needle colour interpolates green → yellow → red as deviation grows
 */

// ── Configuration ────────────────────────────────────────────
const MAX_CENTS        = 50;   // cents at full needle deflection
const MAX_ANGLE        = 80;   // degrees of needle rotation at MAX_CENTS
const IN_TUNE_CENTS    = 3;    // cents threshold for "in tune"
const CENTS_SMOOTH     = 0.14; // lerp rate for needle smoothing
const OPACITY_SMOOTH   = 0.10; // lerp rate for fade-in/out

// ── State ────────────────────────────────────────────────────
let container     = null;
let noteEl        = null;
let centsEl       = null;
let needleGroupEl = null;
let pivotEl       = null;
let arcInTuneEl   = null;
let svgEl         = null;
let wrapEl        = null;

let smoothedCents   = 0;
let smoothedOpacity = 0;
let rafId           = null;
let running         = false;

let _note   = null;
let _cents  = 0;
let _volume = 0;
let _inTune = false;

// ── Public API ───────────────────────────────────────────────

/**
 * Build the tuner display inside containerEl.
 * @param {HTMLElement} containerEl
 */
export function init(containerEl) {
  container       = containerEl;
  smoothedCents   = 0;
  smoothedOpacity = 0;
  _note = null; _cents = 0; _volume = 0; _inTune = false;

  wrapEl = document.createElement('div');
  wrapEl.className = 'td-wrap';

  // ── Note + cents text ──
  const textArea = document.createElement('div');
  textArea.className = 'td-text';

  noteEl = document.createElement('div');
  noteEl.className = 'td-note';
  noteEl.textContent = '--';
  noteEl.setAttribute('aria-live', 'polite');
  noteEl.setAttribute('aria-label', 'Detected note');

  centsEl = document.createElement('div');
  centsEl.className = 'td-cents';
  centsEl.textContent = '';

  textArea.append(noteEl, centsEl);

  // ── SVG arc meter ──
  const meterArea = document.createElement('div');
  meterArea.className = 'td-meter-area';

  svgEl = createArcSVG();
  meterArea.append(svgEl);

  // ── Labels ──
  const labels = document.createElement('div');
  labels.className = 'td-labels';
  labels.setAttribute('aria-hidden', 'true');
  labels.innerHTML = '<span>♭ FLAT</span><span>IN TUNE</span><span>SHARP ♯</span>';

  meterArea.append(labels);
  wrapEl.append(textArea, meterArea);
  containerEl.append(wrapEl);
}

/** Update the target display values. Called each audio frame. */
export function setTuningState(note, cents, volume, inTune) {
  _note   = note;
  _cents  = (cents == null || Number.isNaN(cents)) ? 0 : cents;
  _volume = volume || 0;
  _inTune = !!inTune;
}

/** Start the rAF render loop. */
export function start() {
  if (running) return;
  running = true;
  rafId = requestAnimationFrame(renderLoop);
}

/** Stop the rAF render loop. */
export function stop() {
  running = false;
  if (rafId != null) { cancelAnimationFrame(rafId); rafId = null; }
}

/** Show or hide the display. */
export function setActive(active) {
  if (!wrapEl) return;
  wrapEl.classList.toggle('hidden', !active);
}

/** Tear down DOM and release references. */
export function destroy() {
  stop();
  if (wrapEl) { wrapEl.remove(); wrapEl = null; }
  container = noteEl = centsEl = needleGroupEl = pivotEl = arcInTuneEl = svgEl = null;
  smoothedCents = 0; smoothedOpacity = 0;
}

// ── Render loop ──────────────────────────────────────────────

function renderLoop() {
  if (!running) return;

  // Smooth cents and opacity
  smoothedCents   += CENTS_SMOOTH   * (_cents   - smoothedCents);
  const targetOp   = Math.min(1, _volume * 8);
  smoothedOpacity += OPACITY_SMOOTH * (targetOp - smoothedOpacity);

  const abs     = Math.abs(smoothedCents);
  const angle   = Math.max(-MAX_ANGLE, Math.min(MAX_ANGLE, (smoothedCents / MAX_CENTS) * MAX_ANGLE));
  const color   = centsColor(abs);
  const opacity = smoothedOpacity;

  // Needle
  if (needleGroupEl) {
    needleGroupEl.style.transform  = `rotate(${angle}deg)`;
    needleGroupEl.style.color      = color;
    needleGroupEl.style.opacity    = opacity;
  }
  if (pivotEl) {
    pivotEl.style.color   = color;
    pivotEl.style.opacity = opacity;
  }

  // In-tune arc highlight
  if (arcInTuneEl) {
    arcInTuneEl.style.opacity = (abs < IN_TUNE_CENTS && opacity > 0.2) ? '1' : '0';
  }

  // Note name
  if (noteEl) {
    const label = _note ? formatNote(_note) : '--';
    if (noteEl.textContent !== label) noteEl.textContent = label;
    noteEl.style.opacity = _note ? Math.max(0.35, opacity) : '0.3';
  }

  // Cents label
  if (centsEl) {
    if (_note && opacity > 0.15) {
      const sign  = smoothedCents >= 0 ? '+' : '';
      const val   = Math.round(smoothedCents);
      const label = `${sign}${val}¢`;
      if (centsEl.textContent !== label) centsEl.textContent = label;
      centsEl.style.opacity = '1';
      centsEl.style.color   = color;
    } else {
      centsEl.textContent = '';
    }
  }

  // In-tune class on wrap (for CSS feedback)
  if (wrapEl) {
    wrapEl.classList.toggle('in-tune', _inTune && opacity > 0.2);
  }

  rafId = requestAnimationFrame(renderLoop);
}

// ── SVG construction ─────────────────────────────────────────

function createArcSVG() {
  const NS  = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(NS, 'svg');
  svg.setAttribute('class', 'td-arc');
  svg.setAttribute('viewBox', '-115 -108 230 132');
  svg.setAttribute('preserveAspectRatio', 'xMidYMid meet');
  svg.setAttribute('aria-hidden', 'true');

  // ── Arc track (background) ──
  // Endpoints for 160° arc (80° each side from top, radius 100):
  //   left:  (-sin80°·100, -cos80°·100) ≈ (-98.48, -17.36)
  //   right: ( sin80°·100, -cos80°·100) ≈ ( 98.48, -17.36)
  const arcPath = document.createElementNS(NS, 'path');
  arcPath.setAttribute('d', 'M -98.48 -17.36 A 100 100 0 0 1 98.48 -17.36');
  arcPath.setAttribute('class', 'td-arc-track');

  // ── In-tune zone highlight (small green arc at top) ──
  // ±5° from top gives a narrow green band
  //   left:  (-sin5°·100, -cos5°·100) ≈ (-8.72, -99.62)
  //   right: ( sin5°·100, -cos5°·100) ≈ ( 8.72, -99.62)
  arcInTuneEl = document.createElementNS(NS, 'path');
  arcInTuneEl.setAttribute('d', 'M -8.72 -99.62 A 100 100 0 0 1 8.72 -99.62');
  arcInTuneEl.setAttribute('class', 'td-arc-intune');
  arcInTuneEl.style.opacity = '0';

  // ── Scale ticks ──
  const ticks = document.createElementNS(NS, 'g');
  ticks.setAttribute('class', 'td-ticks');
  // Center tick (in-tune)
  ticks.appendChild(makeTick(NS, 0, 100, 14, true));
  // Quarter ticks (±25 cents = ±40°)
  ticks.appendChild(makeTick(NS, -40, 100, 8, false));
  ticks.appendChild(makeTick(NS,  40, 100, 8, false));
  // Edge ticks (±50 cents = ±80°)
  ticks.appendChild(makeTick(NS, -80, 100, 8, false));
  ticks.appendChild(makeTick(NS,  80, 100, 8, false));

  // ── Needle group (rotates around origin) ──
  needleGroupEl = document.createElementNS(NS, 'g');
  needleGroupEl.setAttribute('class', 'td-needle-group');
  needleGroupEl.style.transformOrigin = '0px 0px';

  const needle = document.createElementNS(NS, 'line');
  needle.setAttribute('x1', '0');
  needle.setAttribute('y1', '6');
  needle.setAttribute('x2', '0');
  needle.setAttribute('y2', '-88');
  needle.setAttribute('class', 'td-needle');

  needleGroupEl.appendChild(needle);

  // ── Pivot circle ──
  pivotEl = document.createElementNS(NS, 'circle');
  pivotEl.setAttribute('cx', '0');
  pivotEl.setAttribute('cy', '0');
  pivotEl.setAttribute('r', '7');
  pivotEl.setAttribute('class', 'td-pivot');

  svg.append(arcPath, arcInTuneEl, ticks, needleGroupEl, pivotEl);
  return svg;
}

/** Create a radial tick mark at the given angle (degrees from top). */
function makeTick(NS, angleDeg, radius, length, isCenter) {
  const rad    = (angleDeg * Math.PI) / 180;
  const outerR = radius + 4;
  const innerR = radius + 4 - length;
  const x1     = Math.sin(rad) * outerR;
  const y1     = -Math.cos(rad) * outerR;
  const x2     = Math.sin(rad) * innerR;
  const y2     = -Math.cos(rad) * innerR;
  const line   = document.createElementNS(NS, 'line');
  line.setAttribute('x1', x1.toFixed(2));
  line.setAttribute('y1', y1.toFixed(2));
  line.setAttribute('x2', x2.toFixed(2));
  line.setAttribute('y2', y2.toFixed(2));
  line.setAttribute('class', isCenter ? 'td-tick td-tick--center' : 'td-tick');
  return line;
}

// ── Helpers ──────────────────────────────────────────────────

function formatNote(note) {
  return note
    .replace('#', '♯')
    .replace('b', '♭');
}

function centsColor(abs) {
  if (abs <= IN_TUNE_CENTS)  return '#2dce72';  // green
  if (abs >= 20)             return '#e85454';  // red
  // 3–12.5 → green→yellow
  if (abs <= 12.5) {
    const t = (abs - IN_TUNE_CENTS) / (12.5 - IN_TUNE_CENTS);
    return blendHex('#2dce72', '#f0c040', t);
  }
  // 12.5–20 → yellow→red
  const t = (abs - 12.5) / 7.5;
  return blendHex('#f0c040', '#e85454', t);
}

function blendHex(a, b, t) {
  const [r1, g1, b1] = hexToRgb(a);
  const [r2, g2, b2] = hexToRgb(b);
  const r  = Math.round(r1 + (r2 - r1) * t);
  const g  = Math.round(g1 + (g2 - g1) * t);
  const bl = Math.round(b1 + (b2 - b1) * t);
  return `rgb(${r},${g},${bl})`;
}

function hexToRgb(hex) {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 0xff, (n >> 8) & 0xff, n & 0xff];
}
