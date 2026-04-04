import test from 'node:test';
import assert from 'node:assert/strict';

import {
  applyAutoDetectFrame,
  expireManualLock,
  isManualLockActive,
} from '../js/autoDetectState.js';

test('applyAutoDetectFrame only switches strings after the required debounce frames', () => {
  let state = { activeStringIndex: 0, pendingAutoStringIndex: null, pendingAutoFrames: 0 };

  state = applyAutoDetectFrame(state, 2, 3);
  assert.deepEqual(state, { activeStringIndex: 0, pendingAutoStringIndex: 2, pendingAutoFrames: 1 });

  state = applyAutoDetectFrame(state, 2, 3);
  assert.deepEqual(state, { activeStringIndex: 0, pendingAutoStringIndex: 2, pendingAutoFrames: 2 });

  state = applyAutoDetectFrame(state, 2, 3);
  assert.deepEqual(state, { activeStringIndex: 2, pendingAutoStringIndex: 2, pendingAutoFrames: 3 });
});

test('applyAutoDetectFrame resets debounce when the detected string changes', () => {
  const state = applyAutoDetectFrame(
    { activeStringIndex: 0, pendingAutoStringIndex: 2, pendingAutoFrames: 2 },
    4,
    3,
  );

  assert.deepEqual(state, { activeStringIndex: 0, pendingAutoStringIndex: 4, pendingAutoFrames: 1 });
});

test('manual lock helpers report active state and clear expired locks', () => {
  const now = 1000;
  assert.equal(isManualLockActive(now + 500, now), true);
  assert.equal(isManualLockActive(now - 1, now), false);
  assert.equal(expireManualLock(now + 500, now), now + 500);
  assert.equal(expireManualLock(now - 1, now), 0);
});
