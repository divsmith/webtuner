/**
 * noteUtils.js — frequency / note / cents conversion helpers
 */

export const NOTE_NAMES = ['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'];
export const NOTE_INPUT_OPTIONS = ['C', 'C#', 'Db', 'D', 'D#', 'Eb', 'E', 'F', 'F#', 'Gb', 'G', 'G#', 'Ab', 'A', 'A#', 'Bb', 'B'];
export const TUNER_MIN_FREQ = 65;
export const TUNER_MAX_FREQ = 420;
export const CUSTOM_TUNING_OCTAVES = [2, 3, 4];

const NOTE_TO_SEMITONE = {
  C:0, 'C#':1, Db:1, D:2, 'D#':3, Eb:3,
  E:4, F:5, 'F#':6, Gb:6, G:7, 'G#':8,
  Ab:8, A:9, 'A#':10, Bb:10, B:11,
};

export function midiToFreq(midi) {
  return 440 * Math.pow(2, (midi - 69) / 12);
}

export function freqToMidi(freq) {
  return 12 * Math.log2(freq / 440) + 69;
}

export function parseNoteString(str) {
  const match = String(str).trim().match(/^([A-G][b#]?)(\d)$/);
  if (!match) return null;

  const semitone = NOTE_TO_SEMITONE[match[1]];
  if (semitone === undefined) return null;

  return {
    note: match[1],
    octave: parseInt(match[2], 10),
    semitone,
  };
}

/** Returns { name, octave } for the nearest note to freq. */
export function freqToNote(freq) {
  const midi    = Math.round(freqToMidi(freq));
  const semitone = ((midi % 12) + 12) % 12;
  const octave   = Math.floor(midi / 12) - 1;
  return { name: NOTE_NAMES[semitone], octave };
}

/** Cents deviation of freq from targetFreq. Positive = sharp. */
export function centsDiff(freq, targetFreq) {
  return 1200 * Math.log2(freq / targetFreq);
}

/**
 * Parse a note string such as "E2", "A#3", "Eb4", "F#3" → Hz.
 * Returns null on bad input.
 */
export function noteStringToFreq(str) {
  const parsed = parseNoteString(str);
  if (!parsed) return null;

  const midi = (parsed.octave + 1) * 12 + parsed.semitone;
  return midiToFreq(midi);
}

export function sanitizeNoteLabel(str) {
  const parsed = parseNoteString(str);
  if (!parsed) return null;
  return `${parsed.note}${parsed.octave}`;
}

export function isNoteInTunerRange(label) {
  const freq = noteStringToFreq(label);
  return Number.isFinite(freq) && freq >= TUNER_MIN_FREQ && freq <= TUNER_MAX_FREQ;
}

export function getSupportedNoteOptionsForOctave(octave) {
  return NOTE_INPUT_OPTIONS.filter((note) => isNoteInTunerRange(`${note}${octave}`));
}

/**
 * Given a detected frequency and an array of target frequencies,
 * return the index of the nearest string (by minimum absolute cents distance).
 */
export function nearestStringIndex(freq, stringFreqs) {
  if (!Number.isFinite(freq) || !Array.isArray(stringFreqs) || stringFreqs.length === 0) {
    return 0;
  }

  let bestIdx  = 0;
  let bestDist = Infinity;
  for (let i = 0; i < stringFreqs.length; i++) {
    const dist = Math.abs(centsDiff(freq, stringFreqs[i]));
    if (dist < bestDist) { bestDist = dist; bestIdx = i; }
  }
  return bestIdx;
}
