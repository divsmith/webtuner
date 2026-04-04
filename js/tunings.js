/**
 * tunings.js — preset tuning definitions + custom tuning CRUD via localStorage
 */

import { isNoteInTunerRange, noteStringToFreq, sanitizeNoteLabel } from './noteUtils.js';

const STORAGE_KEY = 'webtuner_custom_tunings';
const LAST_TUNING_KEY = 'webtuner_last_tuning';
const MAX_CUSTOM_TUNINGS = 5;

function slugifyName(name) {
  return String(name)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'custom-tuning';
}

function customIdFromName(name) {
  const slug = slugifyName(name);
  return slug.startsWith('custom-') ? slug : `custom-${slug}`;
}

function makeStrings(noteLabels) {
  return noteLabels.map((label) => ({
    label,
    freq: noteStringToFreq(label),
  }));
}

function makePresetTuning(name, notes) {
  return {
    id: slugifyName(name),
    name,
    strings: makeStrings(notes),
    isCustom: false,
  };
}

export const PRESETS = [
  makePresetTuning('Standard', ['E2', 'A2', 'D3', 'G3', 'B3', 'E4']),
  makePresetTuning('Drop D', ['D2', 'A2', 'D3', 'G3', 'B3', 'E4']),
  makePresetTuning('Half Step Down', ['Eb2', 'Ab2', 'Db3', 'Gb3', 'Bb3', 'Eb4']),
  makePresetTuning('Full Step Down', ['D2', 'G2', 'C3', 'F3', 'A3', 'D4']),
  makePresetTuning('Drop C', ['C2', 'G2', 'C3', 'F3', 'A3', 'D4']),
  makePresetTuning('Open G', ['D2', 'G2', 'D3', 'G3', 'B3', 'D4']),
  makePresetTuning('Open D', ['D2', 'A2', 'D3', 'F#3', 'A3', 'D4']),
  makePresetTuning('Open E', ['E2', 'B2', 'E3', 'G#3', 'B3', 'E4']),
  makePresetTuning('DADGAD', ['D2', 'A2', 'D3', 'G3', 'A3', 'D4']),
];

function getStorage() {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

function safeGetItem(key) {
  const storage = getStorage();
  if (!storage) return null;

  try {
    return storage.getItem(key);
  } catch {
    return null;
  }
}

function safeSetItem(key, value) {
  const storage = getStorage();
  if (!storage) return false;

  try {
    storage.setItem(key, value);
    return true;
  } catch {
    return false;
  }
}

function dedupeTuningsById(list) {
  const unique = new Map();

  list.forEach((tuning) => {
    if (tuning?.id) {
      unique.set(tuning.id, tuning);
    }
  });

  return Array.from(unique.values());
}

function normalizeTuning(raw, isCustom = false) {
  if (!raw || typeof raw !== 'object') return null;

  const name = String(raw.name || '').trim();
  if (!name) return null;

  const labels = Array.isArray(raw.strings)
    ? raw.strings.map((stringDef) => sanitizeNoteLabel(stringDef?.label))
    : [];

  if (labels.length !== 6 || labels.some((label) => !label)) {
    return null;
  }

  if (labels.some((label) => !isNoteInTunerRange(label))) {
    return null;
  }

  return {
    id: isCustom ? customIdFromName(raw.id || name) : slugifyName(raw.id || name),
    name,
    strings: makeStrings(labels),
    isCustom,
  };
}

function writeCustomTunings(list) {
  const deduped = dedupeTuningsById(list);

  safeSetItem(
    STORAGE_KEY,
    JSON.stringify(
      deduped.map((tuning) => ({
        id: tuning.id,
        name: tuning.name,
        strings: tuning.strings.map((stringDef) => ({ label: stringDef.label })),
      })),
    ),
  );
}

export function getCustomTunings() {
  try {
    const raw = JSON.parse(safeGetItem(STORAGE_KEY) || '[]');
    if (!Array.isArray(raw)) {
      writeCustomTunings([]);
      return [];
    }

    const normalized = dedupeTuningsById(raw
      .map((item) => normalizeTuning(item, true))
      .filter(Boolean));
    const limited = normalized.slice(-MAX_CUSTOM_TUNINGS);

    if (limited.length !== raw.length || limited.length !== normalized.length) {
      writeCustomTunings(limited);
    }

    return limited;
  } catch {
    writeCustomTunings([]);
    return [];
  }
}

export function createCustomTuning(name, noteLabels) {
  const cleanName = String(name || '').trim();
  const labels = Array.isArray(noteLabels)
    ? noteLabels.map((label) => sanitizeNoteLabel(label))
    : [];

  if (!cleanName) {
    throw new Error('Please enter a name for your custom tuning.');
  }

  if (labels.length !== 6 || labels.some((label) => !label)) {
    throw new Error('Each string must use a valid note like E2, F#3, or Bb3.');
  }

  if (labels.some((label) => !isNoteInTunerRange(label))) {
    throw new Error('Custom tuning notes must stay within the tuner supported range.');
  }

  return {
    id: customIdFromName(cleanName),
    name: cleanName,
    strings: makeStrings(labels),
    isCustom: true,
  };
}

export function saveCustomTuning(tuning) {
  const normalized = normalizeTuning(tuning, true);
  if (!normalized) {
    throw new Error('Invalid custom tuning data.');
  }

  const list = getCustomTunings();
  const idx = list.findIndex((item) => item.id === normalized.id);
  if (idx >= 0) {
    if (list[idx].name !== normalized.name) {
      throw new Error('A custom tuning with a similar name already exists. Rename it to save both.');
    }
    list[idx] = normalized;
  } else {
    if (list.length >= MAX_CUSTOM_TUNINGS) {
      list.shift();
    }
    list.push(normalized);
  }
  writeCustomTunings(list);
}

export function deleteCustomTuning(id) {
  const list = getCustomTunings().filter((tuning) => tuning.id !== id);
  writeCustomTunings(list);
}

export function getAllTunings() {
  const customs = getCustomTunings().map((tuning) => ({ ...tuning, isCustom: true }));
  return [...PRESETS, ...customs];
}

export function findTuningById(id) {
  return getAllTunings().find((tuning) => tuning.id === id) || null;
}

export function getLastTuningId() {
  const savedId = safeGetItem(LAST_TUNING_KEY);
  return findTuningById(savedId) ? savedId : PRESETS[0].id;
}

export function setLastTuningId(id) {
  safeSetItem(LAST_TUNING_KEY, id);
}
