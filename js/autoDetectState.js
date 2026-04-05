export function applyAutoDetectFrame(state, nextIndex, requiredFrames) {
  const pendingAutoStringIndex = nextIndex;
  const pendingAutoFrames = state.pendingAutoStringIndex === nextIndex
    ? state.pendingAutoFrames + 1
    : 1;

  return {
    ...state,
    activeStringIndex: pendingAutoFrames >= requiredFrames ? nextIndex : state.activeStringIndex,
    pendingAutoStringIndex,
    pendingAutoFrames,
  };
}

export function isManualLockActive(lockUntil, now = Date.now()) {
  return lockUntil > now;
}

export function expireManualLock(lockUntil, now = Date.now()) {
  return isManualLockActive(lockUntil, now) ? lockUntil : 0;
}
