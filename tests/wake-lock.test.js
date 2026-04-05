import test from 'node:test';
import assert from 'node:assert/strict';

globalThis.document = {
  hidden: false,
  addEventListener() {},
  removeEventListener() {},
};

const { request, release, isActive } = await import('../js/wakeLock.js');

function setNavigator(value) {
  Object.defineProperty(globalThis, 'navigator', {
    value, writable: true, configurable: true,
  });
}

function installWakeLockMock() {
  const listeners = {};
  setNavigator({
    wakeLock: {
      request: async () => ({
        addEventListener(event, cb) { listeners[event] = cb; },
        release() { if (listeners.release) listeners.release(); },
      }),
    },
  });
}

test('request returns false when API is unsupported', async () => {
  setNavigator({});
  const result = await request();
  assert.equal(result, false);
});

test('request returns true when API is available', async () => {
  installWakeLockMock();
  const result = await request();
  assert.equal(result, true);
  release();
});

test('release clears the sentinel', async () => {
  installWakeLockMock();
  await request();
  assert.equal(isActive(), true);
  release();
  assert.equal(isActive(), false);
});

test('isActive reflects lock state', async () => {
  assert.equal(isActive(), false, 'initially false');

  installWakeLockMock();
  await request();
  assert.equal(isActive(), true, 'true after request');

  release();
  assert.equal(isActive(), false, 'false after release');
});
