import test from 'node:test';
import assert from 'node:assert/strict';

class MemoryStorage {
  constructor() {
    this.store = new Map();
  }

  getItem(key) {
    return this.store.has(key) ? this.store.get(key) : null;
  }

  setItem(key, value) {
    this.store.set(key, String(value));
  }

  removeItem(key) {
    this.store.delete(key);
  }

  clear() {
    this.store.clear();
  }
}

function installStorage() {
  const localStorage = new MemoryStorage();
  globalThis.window = { localStorage };
  return localStorage;
}

function makeLabels(root = 'E', octave = 2) {
  return [`${root}${octave}`, 'A2', 'D3', 'G3', 'B3', 'E4'];
}

test('createCustomTuning rejects notes outside supported detector range', async () => {
  installStorage();
  const { createCustomTuning } = await import('../js/tunings.js');

  assert.throws(
    () => createCustomTuning('Too High', ['A4', 'A2', 'D3', 'G3', 'B3', 'E4']),
    /supported range/i,
  );
});

test('saveCustomTuning keeps only the five most recent custom tunings', async () => {
  installStorage();
  const { createCustomTuning, getCustomTunings, saveCustomTuning } = await import('../js/tunings.js');

  const names = ['One', 'Two', 'Three', 'Four', 'Five', 'Six'];
  const roots = ['E', 'F', 'G', 'A', 'B', 'C'];

  names.forEach((name, index) => {
    saveCustomTuning(createCustomTuning(name, makeLabels(roots[index], 2)));
  });

  const saved = getCustomTunings();
  assert.equal(saved.length, 5);
  assert.deepEqual(saved.map((tuning) => tuning.name), ['Two', 'Three', 'Four', 'Five', 'Six']);
});

test('getCustomTunings discards unsupported stored notes and trims to five entries', async () => {
  const storage = installStorage();
  const rawTunings = [
    { id: 'custom-too-high', name: 'Too High', strings: [{ label: 'A4' }, { label: 'A2' }, { label: 'D3' }, { label: 'G3' }, { label: 'B3' }, { label: 'E4' }] },
    { id: 'custom-one', name: 'One', strings: [{ label: 'E2' }, { label: 'A2' }, { label: 'D3' }, { label: 'G3' }, { label: 'B3' }, { label: 'E4' }] },
    { id: 'custom-two', name: 'Two', strings: [{ label: 'F2' }, { label: 'A2' }, { label: 'D3' }, { label: 'G3' }, { label: 'B3' }, { label: 'E4' }] },
    { id: 'custom-three', name: 'Three', strings: [{ label: 'G2' }, { label: 'A2' }, { label: 'D3' }, { label: 'G3' }, { label: 'B3' }, { label: 'E4' }] },
    { id: 'custom-four', name: 'Four', strings: [{ label: 'A2' }, { label: 'A2' }, { label: 'D3' }, { label: 'G3' }, { label: 'B3' }, { label: 'E4' }] },
    { id: 'custom-five', name: 'Five', strings: [{ label: 'B2' }, { label: 'A2' }, { label: 'D3' }, { label: 'G3' }, { label: 'B3' }, { label: 'E4' }] },
    { id: 'custom-six', name: 'Six', strings: [{ label: 'C3' }, { label: 'A2' }, { label: 'D3' }, { label: 'G3' }, { label: 'B3' }, { label: 'E4' }] },
  ];
  storage.setItem('webtuner_custom_tunings', JSON.stringify(rawTunings));

  const { getCustomTunings } = await import('../js/tunings.js');

  const saved = getCustomTunings();
  assert.equal(saved.length, 5);
  assert.deepEqual(saved.map((tuning) => tuning.name), ['Two', 'Three', 'Four', 'Five', 'Six']);
  assert(saved.every((tuning) => tuning.strings.every((stringDef) => stringDef.label !== 'A4')));
});

test('saveCustomTuning rejects a different tuning name that resolves to the same slug', async () => {
  installStorage();
  const { createCustomTuning, saveCustomTuning } = await import('../js/tunings.js');

  saveCustomTuning(createCustomTuning('My Tuning', makeLabels('E', 2)));

  assert.throws(
    () => saveCustomTuning(createCustomTuning('My-Tuning', makeLabels('F', 2))),
    /already exists/i,
  );
});
