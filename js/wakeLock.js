/** @module wakeLock – keeps the screen on while the tuner is active */

let _sentinel = null;
let _requested = false;

/** @type {(() => void) | null} */
let _onVisibilityChange = null;

/**
 * Request a screen wake lock.
 * Also installs a visibilitychange listener to re-acquire the lock
 * when the user returns to the tab.
 * @returns {Promise<boolean>} true if the lock was acquired
 */
export async function request() {
  if (!('wakeLock' in navigator)) return false;

  try {
    _sentinel = await navigator.wakeLock.request('screen');
    _requested = true;

    _sentinel.addEventListener('release', () => {
      _sentinel = null;
    });

    if (!_onVisibilityChange) {
      _onVisibilityChange = async () => {
        if (!document.hidden && _requested && !_sentinel) {
          try {
            _sentinel = await navigator.wakeLock.request('screen');
            _sentinel.addEventListener('release', () => {
              _sentinel = null;
            });
          } catch (_) { /* re-acquire failed */ }
        }
      };
      document.addEventListener('visibilitychange', _onVisibilityChange);
    }

    return true;
  } catch (_) {
    return false;
  }
}

/**
 * Release the wake lock and remove the visibilitychange listener.
 * No-op if no lock is held.
 */
export function release() {
  _requested = false;

  if (_onVisibilityChange) {
    document.removeEventListener('visibilitychange', _onVisibilityChange);
    _onVisibilityChange = null;
  }

  if (_sentinel) {
    _sentinel.release();
    _sentinel = null;
  }
}

/**
 * @returns {boolean} true if a wake lock is currently held
 */
export function isActive() {
  return _sentinel !== null;
}
