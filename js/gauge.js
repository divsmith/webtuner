// ── Tuning gauge – horizontal cents indicator ──

let els = null;
let smoothedCents = 0;
let smoothedOpacity = 0;

/**
 * Create gauge DOM inside the given container.
 * @param {HTMLElement} containerEl
 */
export function init(containerEl) {
  smoothedCents = 0;
  smoothedOpacity = 0;

  const gauge = document.createElement('div');
  gauge.className = 'gauge';

  const track = document.createElement('div');
  track.className = 'gauge-track';

  const center = document.createElement('div');
  center.className = 'gauge-center';

  const indicator = document.createElement('div');
  indicator.className = 'gauge-indicator';

  track.append(center, indicator);
  gauge.append(track);
  containerEl.append(gauge);

  els = { gauge, track, indicator };
}

/**
 * Update indicator position, color, and opacity.
 * Called every animation frame by app.js.
 * @param {number} cents  – offset from in-tune (-50…+50)
 * @param {number} volume – RMS level (0–1)
 */
export function update(cents, volume) {
  if (!els) return;

  const c = (cents == null || Number.isNaN(cents)) ? 0 : cents;
  smoothedCents += 0.15 * (c - smoothedCents);

  const targetOpacity = Math.min(1, (volume || 0) * 8);
  smoothedOpacity += 0.1 * (targetOpacity - smoothedOpacity);

  // Position
  const trackW = els.track.getBoundingClientRect().width;
  const halfTrack = trackW / 2;
  const px = Math.max(-halfTrack, Math.min(halfTrack, (smoothedCents / 50) * halfTrack));
  els.indicator.style.transform = `translate(calc(-50% + ${px}px), -50%)`;

  // Color
  const abs = Math.abs(smoothedCents);
  const color = centsColor(abs);
  els.indicator.style.background = color;
  els.indicator.style.boxShadow = `0 0 12px 4px ${color}44, 0 0 24px 8px ${color}22`;

  // Opacity
  els.indicator.style.opacity = smoothedOpacity;

  // In-tune class
  const inTune = abs < 3;
  els.indicator.classList.toggle('in-tune', inTune);
  els.gauge.classList.toggle('in-tune', inTune);
}

/**
 * Show or hide the gauge.
 * @param {boolean} active
 */
export function setActive(active) {
  if (!els) return;
  els.gauge.classList.toggle('hidden', !active);
}

/** Remove gauge DOM and release references. */
export function destroy() {
  if (!els) return;
  els.gauge.remove();
  els = null;
  smoothedCents = 0;
  smoothedOpacity = 0;
}

// ── Helpers ──

function centsColor(abs) {
  if (abs > 20) return '#e85454';
  if (abs > 5) return lerpColor('#2dce72', '#f0c040', '#e85454', abs);
  return '#2dce72';
}

function lerpColor(green, yellow, red, abs) {
  // 5–12.5 → green→yellow, 12.5–20 → yellow→red
  if (abs <= 12.5) {
    const t = (abs - 5) / 7.5;
    return blendHex(green, yellow, t);
  }
  const t = (abs - 12.5) / 7.5;
  return blendHex(yellow, red, t);
}

function blendHex(a, b, t) {
  const [r1, g1, b1] = hexToRgb(a);
  const [r2, g2, b2] = hexToRgb(b);
  const r = Math.round(r1 + (r2 - r1) * t);
  const g = Math.round(g1 + (g2 - g1) * t);
  const bl = Math.round(b1 + (b2 - b1) * t);
  return `rgb(${r},${g},${bl})`;
}

function hexToRgb(hex) {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 0xff, (n >> 8) & 0xff, n & 0xff];
}
