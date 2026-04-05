/**
 * ui.js — All DOM rendering (string buttons, tuning selector, modal, screens)
 */

import {
  CUSTOM_TUNING_OCTAVES,
  getSupportedNoteOptionsForOctave,
  parseNoteString,
  sanitizeNoteLabel,
} from './noteUtils.js';

// ── Cached DOM refs ──────────────────────────────────────────
const $ = id => document.getElementById(id);
let modalFocusTimer = null;

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
