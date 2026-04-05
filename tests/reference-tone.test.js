import test from 'node:test';
import assert from 'node:assert/strict';

function createMockAudioContext() {
  return {
    state: 'running',
    currentTime: 0,
    destination: {},
    resume: () => Promise.resolve(),
    createGain: () => ({
      gain: { value: 0, setValueAtTime() {}, linearRampToValueAtTime() {} },
      connect() {},
    }),
    createOscillator: () => ({
      type: 'sine',
      frequency: { value: 0 },
      connect() {},
      start() {},
      stop() {},
      disconnect() {},
    }),
  };
}

const { init, play, stop, isPlaying } = await import('../js/referenceTone.js');

test('isPlaying is false initially', () => {
  assert.equal(isPlaying(), false);
});

test('play sets isPlaying to true', () => {
  init(createMockAudioContext());
  play(440);
  assert.equal(isPlaying(), true);
  stop();
});

test('stop sets isPlaying to false', () => {
  init(createMockAudioContext());
  play(440);
  stop();
  assert.equal(isPlaying(), false);
});

test('play stops previous tone before starting new one', () => {
  let gainRampCalls = 0;
  const ctx = createMockAudioContext();
  const origCreateGain = ctx.createGain;
  ctx.createGain = () => {
    const g = origCreateGain();
    g.gain.linearRampToValueAtTime = () => { gainRampCalls++; };
    return g;
  };

  init(ctx);
  play(440);
  const rampsBefore = gainRampCalls;
  play(330);
  // The second play() calls stop() internally, which ramps gain down
  assert.ok(gainRampCalls > rampsBefore, 'expected gain ramp when stopping previous tone');
  assert.equal(isPlaying(), true);
  stop();
});
