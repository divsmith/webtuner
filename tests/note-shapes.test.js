import test from 'node:test';
import assert from 'node:assert/strict';

import { getShapeMask, scaleShape, SUPPORTED_LETTERS } from '../js/noteShapes.js';

test('getShapeMask returns a valid grid for all supported letters', () => {
  for (const letter of SUPPORTED_LETTERS) {
    const shape = getShapeMask(letter);
    assert.ok(shape, `Shape for "${letter}" should exist`);
    assert.equal(shape.width, 5);
    assert.equal(shape.height, 7);
    assert.equal(shape.grid.length, 7);
    for (const row of shape.grid) {
      assert.equal(row.length, 5);
    }
  }
});

test('getShapeMask handles sharp notes (letter + accidental)', () => {
  const shape = getShapeMask('F#');
  assert.ok(shape);
  // 5 (letter) + 1 (spacing) + 3 (accidental) = 9
  assert.equal(shape.width, 9);
  assert.equal(shape.height, 7);

  // F has top-left filled, # has middle row filled
  assert.equal(shape.grid[0][0], 1); // F starts with #####
});

test('getShapeMask handles flat notes', () => {
  const shape = getShapeMask('Bb');
  assert.ok(shape);
  assert.equal(shape.width, 9);
  assert.equal(shape.height, 7);
});

test('getShapeMask returns null for invalid input', () => {
  assert.equal(getShapeMask(null), null);
  assert.equal(getShapeMask(''), null);
  assert.equal(getShapeMask('X'), null);
});

test('scaleShape doubles dimensions at factor 2', () => {
  const shape = getShapeMask('E');
  const scaled = scaleShape(shape, 2);
  assert.equal(scaled.width, 10);
  assert.equal(scaled.height, 14);
  assert.equal(scaled.grid.length, 14);
  // Each original pixel becomes a 2×2 block
  assert.equal(scaled.grid[0][0], 1); // E top-left is filled
  assert.equal(scaled.grid[0][1], 1); // duplicated
  assert.equal(scaled.grid[1][0], 1); // duplicated row
});

test('scaleShape at factor 1 returns identical shape', () => {
  const shape = getShapeMask('A');
  const same = scaleShape(shape, 1);
  assert.equal(same.width, shape.width);
  assert.equal(same.height, shape.height);
});
