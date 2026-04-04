/**
 * noteShapes.js — Bitmap font definitions for tuner note letters
 *
 * Each letter is a 2D boolean-ish grid stored as an array of strings.
 * '#' = filled pixel, '.' = empty. All shapes are 5 columns × 7 rows.
 * Accidentals (#, b) are 3 columns × 7 rows.
 */

const LETTERS = {
  A: [
    '.###.',
    '#...#',
    '#...#',
    '#####',
    '#...#',
    '#...#',
    '#...#',
  ],
  B: [
    '####.',
    '#...#',
    '#...#',
    '####.',
    '#...#',
    '#...#',
    '####.',
  ],
  C: [
    '.####',
    '#....',
    '#....',
    '#....',
    '#....',
    '#....',
    '.####',
  ],
  D: [
    '####.',
    '#...#',
    '#...#',
    '#...#',
    '#...#',
    '#...#',
    '####.',
  ],
  E: [
    '#####',
    '#....',
    '#....',
    '####.',
    '#....',
    '#....',
    '#####',
  ],
  F: [
    '#####',
    '#....',
    '#....',
    '####.',
    '#....',
    '#....',
    '#....',
  ],
  G: [
    '.###.',
    '#....',
    '#....',
    '#.###',
    '#...#',
    '#...#',
    '.###.',
  ],
};

const ACCIDENTALS = {
  '#': [
    '.#.',
    '###',
    '.#.',
    '###',
    '.#.',
    '...',
    '...',
  ],
  b: [
    '#..',
    '#..',
    '##.',
    '#.#',
    '#.#',
    '##.',
    '...',
  ],
};

const LETTER_WIDTH = 5;
const LETTER_HEIGHT = 7;
const ACCIDENTAL_WIDTH = 3;
const SPACING = 1;

/**
 * Parse a note name like "E", "F#", "Bb" into { letter, accidental }.
 */
function parseNoteName(name) {
  if (!name || typeof name !== 'string') return null;
  const letter = name[0]?.toUpperCase();
  if (!LETTERS[letter]) return null;
  const accidental = name.length > 1 ? name[1] : null;
  return { letter, accidental };
}

/**
 * Get a composite shape mask for a note name.
 * Returns { width, height, grid } where grid[row][col] is 0 or 1.
 */
export function getShapeMask(noteName) {
  const parsed = parseNoteName(noteName);
  if (!parsed) return null;

  const letterGrid = LETTERS[parsed.letter];
  const accGrid = parsed.accidental ? ACCIDENTALS[parsed.accidental] : null;

  const width = LETTER_WIDTH + (accGrid ? SPACING + ACCIDENTAL_WIDTH : 0);
  const height = LETTER_HEIGHT;

  const grid = [];
  for (let r = 0; r < height; r++) {
    const row = new Uint8Array(width);

    // Letter pixels
    const letterRow = letterGrid[r];
    for (let c = 0; c < LETTER_WIDTH; c++) {
      row[c] = letterRow[c] === '#' ? 1 : 0;
    }

    // Accidental pixels (offset by LETTER_WIDTH + SPACING)
    if (accGrid) {
      const accRow = accGrid[r];
      const offset = LETTER_WIDTH + SPACING;
      for (let c = 0; c < ACCIDENTAL_WIDTH; c++) {
        row[offset + c] = accRow[c] === '#' ? 1 : 0;
      }
    }

    grid.push(row);
  }

  return { width, height, grid };
}

/**
 * Scale a shape mask by an integer factor (e.g. 2× or 3×).
 * Each source pixel becomes a factor×factor block.
 */
export function scaleShape(shape, factor) {
  if (!shape || factor < 1) return shape;
  if (factor === 1) return shape;

  const width = shape.width * factor;
  const height = shape.height * factor;
  const grid = [];

  for (let r = 0; r < shape.height; r++) {
    const scaledRow = new Uint8Array(width);
    for (let c = 0; c < shape.width; c++) {
      const val = shape.grid[r][c];
      for (let dx = 0; dx < factor; dx++) {
        scaledRow[c * factor + dx] = val;
      }
    }
    for (let dy = 0; dy < factor; dy++) {
      grid.push(new Uint8Array(scaledRow));
    }
  }

  return { width, height, grid };
}

/** All supported note letters. */
export const SUPPORTED_LETTERS = Object.keys(LETTERS);
