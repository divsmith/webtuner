import test from 'node:test';
import assert from 'node:assert/strict';

import {
  centsDiff,
  freqToMidi,
  getSupportedNoteOptionsForOctave,
  isNoteInTunerRange,
  nearestStringIndex,
  noteStringToFreq,
  parseNoteString,
} from '../js/noteUtils.js';

test('parseNoteString parses natural, sharp, and flat notes', () => {
  assert.deepEqual(parseNoteString('E2'), { note: 'E', octave: 2, semitone: 4 });
  assert.deepEqual(parseNoteString('F#3'), { note: 'F#', octave: 3, semitone: 6 });
  assert.deepEqual(parseNoteString('Bb4'), { note: 'Bb', octave: 4, semitone: 10 });
  assert.equal(parseNoteString('H2'), null);
});

test('noteStringToFreq and freqToMidi stay aligned around concert A', () => {
  const a4 = noteStringToFreq('A4');
  assert.equal(Math.round(a4), 440);
  assert.equal(Math.round(freqToMidi(a4)), 69);
});

test('centsDiff returns zero for a target pitch and signed offsets around it', () => {
  const target = noteStringToFreq('E2');
  assert.equal(Math.round(centsDiff(target, target)), 0);
  assert(centsDiff(target * 1.01, target) > 0);
  assert(centsDiff(target * 0.99, target) < 0);
});

test('nearestStringIndex picks the closest string by cents distance', () => {
  const strings = [
    noteStringToFreq('E2'),
    noteStringToFreq('A2'),
    noteStringToFreq('D3'),
    noteStringToFreq('G3'),
    noteStringToFreq('B3'),
    noteStringToFreq('E4'),
  ];

  assert.equal(nearestStringIndex(noteStringToFreq('A2'), strings), 1);
  assert.equal(nearestStringIndex(noteStringToFreq('D3') * 1.003, strings), 2);
});

test('supported custom note options stay within the tuner range', () => {
  const octaveTwo = getSupportedNoteOptionsForOctave(2);
  const octaveFour = getSupportedNoteOptionsForOctave(4);

  assert(octaveTwo.includes('C'));
  assert(!octaveFour.includes('A'));
  assert.equal(isNoteInTunerRange('C2'), true);
  assert.equal(isNoteInTunerRange('A4'), false);
});
