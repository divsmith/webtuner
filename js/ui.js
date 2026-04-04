/**
 * ui.js — All DOM rendering and SVG gauge management
 */

import {
  CUSTOM_TUNING_OCTAVES,
  getSupportedNoteOptionsForOctave,
  parseNoteString,
  sanitizeNoteLabel,
} from './noteUtils.js';

// ── Gauge geometry constants ─────────────────────────────────
const CX = 160;       // SVG pivot x
const CY = 185;       // SVG pivot y
const R  = 140;       // arc radius
const MAX_CENTS = 50; // ±50 cents = full deflection

/** Convert cents offset → rotation angle in degrees (0° = straight up) */
function centsToAngle(cents) {
  return Math.max(-90, Math.min(90, (cents / MAX_CENTS) * 90));
}

/**
 * Point on the arc at angle θ (degrees, 0=up, positive=clockwise).
 * Returns { x, y } in SVG coordinates.
 */
function arcPt(theta) {
  const rad = theta * (Math.PI / 180);
  return {
    x: CX + R * Math.sin(rad),
    y: CY - R * Math.cos(rad),
  };
}

/**
 * Build an SVG arc path string from angle θ1 to θ2 (both "up=0°").
 * Always travels counterclockwise in screen space → over the top of the circle.
 */
function arcPath(theta1, theta2) {
  const p1 = arcPt(theta1);
  const p2 = arcPt(theta2);
  const largeArc = Math.abs(theta2 - theta1) > 180 ? 1 : 0;
  return `M ${p1.x.toFixed(2)} ${p1.y.toFixed(2)} A ${R} ${R} 0 ${largeArc} 0 ${p2.x.toFixed(2)} ${p2.y.toFixed(2)}`;
}

// ── Cached DOM refs ──────────────────────────────────────────
const $ = id => document.getElementById(id);
let modalFocusTimer = null;

export function initGauge() {
  // Background track: full -90° → +90°
  $('arc-bg').setAttribute('d', arcPath(-90, 90));

  // Colored zone arcs (angle proportional to cents)
  const a = deg => deg; // identity for clarity
  $('arc-red-flat'    ).setAttribute('d', arcPath(a(-90), a(-36)));
  $('arc-yellow-flat' ).setAttribute('d', arcPath(a(-36), a(-9)));
  $('arc-green'       ).setAttribute('d', arcPath(a(-9),  a( 9)));
  $('arc-yellow-sharp').setAttribute('d', arcPath(a( 9),  a(36)));
  $('arc-red-sharp'   ).setAttribute('d', arcPath(a(36),  a(90)));
}

/** Rotate needle to reflect a given cents offset. */
export function updateNeedle(cents) {
  const angle = centsToAngle(isFinite(cents) ? cents : 0);
  $('needle-group').style.transform = `rotate(${angle}deg)`;
}

/** Update the note name and cents readout inside the gauge. */
export function updateNoteDisplay(noteName, octave, cents, silent, inTune = false) {
  const noteEl  = $('gauge-note');
  const centsEl = $('gauge-cents');

  if (silent) {
    noteEl.textContent  = '--';
    centsEl.textContent = '';
    updateNeedle(0);
    hideInTuneBadge();
    return;
  }

  noteEl.textContent = noteName ?? '--';

  if (cents !== null && isFinite(cents)) {
    const sign  = cents >= 0 ? '+' : '';
    centsEl.textContent = `${sign}${Math.round(cents)}¢`;

    if (inTune) {
      showInTuneBadge();
    } else {
      hideInTuneBadge();
    }
  } else {
    centsEl.textContent = '';
    hideInTuneBadge();
  }
}

// ── In-tune badge ────────────────────────────────────────────
let _badgeVisible = false;

export function showInTuneBadge() {
  const el = $('in-tune-badge');
  if (_badgeVisible) return;
  _badgeVisible = true;
  el.classList.remove('hidden');
  // Restart animation each time
  el.style.animation = 'none';
  el.offsetHeight; // reflow
  el.style.animation = '';
}

export function hideInTuneBadge() {
  if (!_badgeVisible) return;
  _badgeVisible = false;
  $('in-tune-badge').classList.add('hidden');
}

// ── String Buttons ───────────────────────────────────────────
/**
 * Render (or re-render) the 6 string buttons.
 * @param {Array<{label: string, freq: number}>} strings
 * @param {number} activeIdx
 * @param {(idx: number) => void} onSelect
 */
export function renderStringButtons(strings, activeIdx, onSelect) {
  const container = $('string-buttons');
  container.innerHTML = '';

  strings.forEach((s, i) => {
    const btn = document.createElement('button');
    btn.type      = 'button';
    btn.className = 'string-btn' + (i === activeIdx ? ' active' : '');
    btn.dataset.idx = i;
    btn.setAttribute('aria-pressed', i === activeIdx ? 'true' : 'false');
    btn.setAttribute('aria-label', `String ${i + 1}: ${s.label}`);
    btn.innerHTML = `
      <span class="s-name">${s.label.replace(/\d/, '')}</span>
      <span class="s-num">${i + 1}</span>`;
    btn.addEventListener('click', () => onSelect(i));
    container.appendChild(btn);
  });
}

/** Highlight the active string button and optionally mark it in-tune. */
export function setActiveString(idx, inTune = false) {
  document.querySelectorAll('.string-btn').forEach((btn, i) => {
    btn.classList.toggle('active',  i === idx);
    btn.classList.toggle('in-tune', i === idx && inTune);
    btn.setAttribute('aria-pressed', i === idx ? 'true' : 'false');
  });
}

// ── Tuning Selector ──────────────────────────────────────────
/**
 * Populate the tuning <select> element.
 * @param {Array<{id:string, name:string, isCustom:boolean}>} tunings
 * @param {string} selectedId
 */
export function renderTuningSelector(tunings, selectedId) {
  const sel = $('tuning-select');
  const prev = sel.value;
  sel.innerHTML = '';

  tunings.forEach(t => {
    const opt = document.createElement('option');
    opt.value       = t.id;
    opt.textContent = t.isCustom ? `★ ${t.name}` : t.name;
    if (t.id === selectedId) opt.selected = true;
    sel.appendChild(opt);
  });

  // Preserve previous selection if it still exists
  if (!selectedId && prev) sel.value = prev;
}

// ── Custom Tuning Modal ──────────────────────────────────────
const STRING_LABELS = ['6 (low)', '5', '4', '3', '2', '1 (high)'];

/** Inject the 6 note-picker rows into #string-editor. */
export function initStringEditor(initialStrings) {
  const editor = $('string-editor');
  editor.innerHTML = '';

  initialStrings.forEach((s, i) => {
    const parsed = parseNoteString(s.label);
    const note = parsed?.note || 'E';
    const oct = CUSTOM_TUNING_OCTAVES.includes(parsed?.octave) ? parsed.octave : (i < 2 ? 2 : i < 5 ? 3 : 4);

    const row = document.createElement('div');
    row.className = 'string-row';
    row.innerHTML = `
      <span class="string-row-label">${STRING_LABELS[i]}</span>
      <select class="string-note-sel" data-row="${i}" aria-label="String ${i+1} note">
        ${buildNoteOptions(oct, note)}
      </select>
      <select class="string-oct-sel" data-row="${i}" aria-label="String ${i+1} octave">
        ${CUSTOM_TUNING_OCTAVES.map(o => `<option value="${o}" ${o === oct ? 'selected' : ''}>${o}</option>`).join('')}
      </select>`;
    row.querySelector('.string-oct-sel').addEventListener('change', () => syncRowNoteOptions(row));
    editor.appendChild(row);
  });
}

/** Read the current note selections from the string editor. */
export function readStringEditor() {
  const noteSels = document.querySelectorAll('.string-note-sel');
  const octSels  = document.querySelectorAll('.string-oct-sel');
  return Array.from(noteSels).map((noteSel, i) => ({
    label: sanitizeNoteLabel(`${noteSel.value}${octSels[i].value}`),
  }));
}

/** Render the saved custom tunings list inside the modal. */
export function renderSavedTunings(customs, onDelete) {
  const list = $('saved-tunings-list');
  const section = $('saved-section');

  if (customs.length === 0) {
    section.style.display = '';
    list.innerHTML = '<p class="saved-empty">No custom tunings saved yet.</p>';
    return;
  }

  section.style.display = '';
  list.innerHTML = '';

  customs.forEach(t => {
    const noteLabels = t.strings.map(s => s.label).join(' ');
    const item = document.createElement('div');
    item.className = 'saved-item';
    item.innerHTML = `
      <span class="saved-item-name">${escHtml(t.name)}</span>
      <span class="saved-item-notes">${escHtml(noteLabels)}</span>
      <button class="btn-delete" type="button" aria-label="Delete ${escHtml(t.name)}">
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
          <path d="M3 3l10 10M13 3L3 13" stroke="currentColor" stroke-width="1.75" stroke-linecap="round"/>
        </svg>
      </button>`;
    item.querySelector('.btn-delete').addEventListener('click', () => onDelete(t.id));
    list.appendChild(item);
  });
}

export function openModal() {
  const el = $('modal-overlay');
  el.classList.remove('hidden');
  $('app').setAttribute('aria-hidden', 'true');
  $('app').inert = true;
  // Focus first input for accessibility
  clearTimeout(modalFocusTimer);
  modalFocusTimer = setTimeout(() => $('custom-name')?.focus(), 50);
}

export function closeModal() {
  clearTimeout(modalFocusTimer);
  modalFocusTimer = null;
  $('modal-overlay').classList.add('hidden');
  $('app').removeAttribute('aria-hidden');
  $('app').inert = false;
}

// ── Screen transitions ───────────────────────────────────────
export function showStartScreen() {
  $('start-screen').classList.remove('hidden');
  $('error-screen').classList.add('hidden');
  $('app').classList.add('hidden');
}

export function showApp() {
  $('start-screen').classList.add('hidden');
  $('error-screen').classList.add('hidden');
  $('app').classList.remove('hidden');
}

export function showError(title, message) {
  $('error-title').textContent = title;
  $('error-msg').textContent   = message;
  $('error-screen').classList.remove('hidden');
  $('start-screen').classList.add('hidden');
  $('app').classList.add('hidden');
}

export function setCustomName(value) {
  $('custom-name').value = value;
}

export function getCustomName() {
  return $('custom-name').value.trim();
}

export function setCustomError(message) {
  const error = $('custom-tuning-error');
  error.textContent = message;
  error.classList.toggle('hidden', !message);
}

export function clearCustomError() {
  setCustomError('');
}

export function getElement(id) {
  return $(id);
}

// ── Helpers ──────────────────────────────────────────────────
function escHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function buildNoteOptions(octave, selectedNote) {
  const options = getSupportedNoteOptionsForOctave(Number(octave));
  const fallback = options[0] || 'E';
  const nextSelected = options.includes(selectedNote) ? selectedNote : fallback;
  return options
    .map((note) => `<option value="${note}" ${note === nextSelected ? 'selected' : ''}>${note}</option>`)
    .join('');
}

function syncRowNoteOptions(row) {
  const noteSelect = row.querySelector('.string-note-sel');
  const octaveSelect = row.querySelector('.string-oct-sel');
  noteSelect.innerHTML = buildNoteOptions(octaveSelect.value, noteSelect.value);
}
