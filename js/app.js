import { applyAutoDetectFrame, expireManualLock, isManualLockActive as hasManualLock } from './autoDetectState.js';
import { centsDiff, nearestStringIndex, parseNoteString } from './noteUtils.js';
import { PitchDetector } from './pitchDetector.js';
import {
  PRESETS,
  createCustomTuning,
  deleteCustomTuning,
  getAllTunings,
  getCustomTunings,
  getLastTuningId,
  setLastTuningId,
  saveCustomTuning,
} from './tunings.js';
import {
  clearCustomError,
  closeModal,
  getCustomName,
  getElement,
  initStringEditor,
  openModal,
  renderSavedTunings,
  renderStringButtons,
  renderTuningSelector,
  readStringEditor,
  setActiveString,
  setCustomError,
  setCustomName,
  showApp,
  showError,
  showStartScreen,
} from './ui.js';
import {
  init as initAsciiTuner,
  start as startAsciiTuner,
  stop as stopAsciiTuner,
  setTuningState,
  destroy as destroyAsciiTuner,
} from './asciiTuner.js';
import {
  init as initGauge,
  update as updateGauge,
  setActive as setGaugeActive,
} from './gauge.js';
import {
  init as initReferenceTone,
  play as playReferenceTone,
  stop as stopReferenceTone,
  isPlaying as isReferenceTonePlaying,
} from './referenceTone.js';
import {
  request as requestWakeLock,
  release as releaseWakeLock,
} from './wakeLock.js';

const AUTO_DETECT_FRAMES = 3;
const MANUAL_LOCK_MS = 5000;
const IN_TUNE_THRESHOLD = 3;

const state = {
  detector: null,
  tunings: [],
  currentTuning: null,
  activeStringIndex: 0,
  pendingAutoStringIndex: null,
  pendingAutoFrames: 0,
  manualLockUntil: 0,
  lastFocusedElement: null,
  isStarting: false,
  currentVolume: 0,
  wasInTune: false,
};

function getTuningById(id) {
  return state.tunings.find((tuning) => tuning.id === id) || null;
}

function isManualLockActive() {
  const nextLock = expireManualLock(state.manualLockUntil);
  if (state.manualLockUntil !== nextLock) {
    state.manualLockUntil = nextLock;
    resetAutoDetectDebounce();
  }

  return hasManualLock(state.manualLockUntil);
}

function resetAutoDetectDebounce() {
  state.pendingAutoStringIndex = null;
  state.pendingAutoFrames = 0;
}

function updateGaugeForSilence() {
  setTuningState(null, 0, 0, false);
  updateGauge(0, 0);
  setActiveString(state.activeStringIndex, false);
  state.wasInTune = false;
}

function updateGaugeForPitch(freq) {
  const targetString = state.currentTuning?.strings[state.activeStringIndex];
  if (!targetString) {
    updateGaugeForSilence();
    return;
  }

  const cents = centsDiff(freq, targetString.freq);
  const parsed = parseNoteString(targetString.label);
  const noteName = parsed?.note || targetString.label.replace(/\d/g, '');
  const inTune = Math.abs(cents) <= IN_TUNE_THRESHOLD;

  setTuningState(noteName, cents, state.currentVolume, inTune);
  updateGauge(cents, state.currentVolume);
  setActiveString(state.activeStringIndex, inTune);

  // Haptic feedback on entering in-tune zone
  if (inTune && !state.wasInTune && navigator.vibrate) {
    navigator.vibrate(50);
  }
  state.wasInTune = inTune;
}

function applyAutoDetect(freq) {
  if (!state.currentTuning || isManualLockActive()) {
    return;
  }

  const nextIndex = nearestStringIndex(
    freq,
    state.currentTuning.strings.map((stringDef) => stringDef.freq),
  );

  const nextState = applyAutoDetectFrame(state, nextIndex, AUTO_DETECT_FRAMES);
  state.activeStringIndex = nextState.activeStringIndex;
  state.pendingAutoStringIndex = nextState.pendingAutoStringIndex;
  state.pendingAutoFrames = nextState.pendingAutoFrames;
}

function handlePitch(freq) {
  if (!Number.isFinite(freq)) {
    resetAutoDetectDebounce();
    updateGaugeForSilence();
    return;
  }

  applyAutoDetect(freq);
  updateGaugeForPitch(freq);
}

function handleManualStringSelect(index) {
  state.activeStringIndex = index;
  state.manualLockUntil = Date.now() + MANUAL_LOCK_MS;
  resetAutoDetectDebounce();
  setActiveString(index, false);
  // Stop reference tone when switching strings
  if (isReferenceTonePlaying()) {
    stopReferenceTone();
    updateRefToneButton(false);
  }
}

function toggleReferenceTone() {
  if (isReferenceTonePlaying()) {
    stopReferenceTone();
    updateRefToneButton(false);
    return;
  }
  const targetString = state.currentTuning?.strings[state.activeStringIndex];
  if (!targetString) return;
  playReferenceTone(targetString.freq);
  updateRefToneButton(true);
}

function updateRefToneButton(playing) {
  const btn = getElement('btn-ref-tone');
  btn.classList.toggle('playing', playing);
  btn.setAttribute('aria-label', playing ? 'Stop reference tone' : 'Play reference tone');
  btn.innerHTML = playing
    ? '<svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true"><rect x="5" y="4" width="4" height="12" rx="1" fill="currentColor"/><rect x="11" y="4" width="4" height="12" rx="1" fill="currentColor"/></svg>'
    : '<svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true"><path d="M6 4v12l10-6z" fill="currentColor"/></svg>';
}

function syncSelectedTuning(preferredId) {
  state.tunings = getAllTunings();

  const selected =
    getTuningById(preferredId)
    || getTuningById(getLastTuningId())
    || PRESETS[0];

  state.currentTuning = selected;
  state.activeStringIndex = Math.min(
    state.activeStringIndex,
    Math.max(selected.strings.length - 1, 0),
  );

  renderTuningSelector(state.tunings, selected.id);
  renderStringButtons(selected.strings, state.activeStringIndex, handleManualStringSelect);
  renderSavedTunings(getCustomTunings(), handleDeleteCustomTuning);
  setActiveString(state.activeStringIndex, false);
  setLastTuningId(selected.id);
  resetAutoDetectDebounce();
}

function resetCustomTuningForm(baseStrings = state.currentTuning?.strings || PRESETS[0].strings) {
  clearCustomError();
  setCustomName('');
  initStringEditor(baseStrings);
}

function openCustomTuningModal() {
  state.lastFocusedElement = document.activeElement;
  renderSavedTunings(getCustomTunings(), handleDeleteCustomTuning);
  resetCustomTuningForm();
  openModal();
}

function closeCustomTuningModal() {
  closeModal();
  clearCustomError();
  state.lastFocusedElement?.focus?.();
}

function handleSaveCustomTuning() {
  try {
    const tuning = createCustomTuning(
      getCustomName(),
      readStringEditor().map((stringDef) => stringDef.label),
    );

     saveCustomTuning(tuning);
     syncSelectedTuning(tuning.id);
     resetCustomTuningForm(tuning.strings);
     closeCustomTuningModal();
  } catch (error) {
    setCustomError(error instanceof Error ? error.message : 'Unable to save that tuning.');
  }
}

function handleDeleteCustomTuning(id) {
  deleteCustomTuning(id);
  const fallbackId = state.currentTuning?.id === id ? PRESETS[0].id : state.currentTuning?.id;
  syncSelectedTuning(fallbackId);
  resetCustomTuningForm();
}

function getStartErrorMessage(error) {
  if (!PitchDetector.isSupported()) {
    return {
      title: 'Browser Not Supported',
      message: 'This tuner needs microphone access through the Web Audio API. Try a current version of Chrome, Safari, or Edge.',
    };
  }

  switch (error?.name) {
    case 'NotAllowedError':
    case 'SecurityError':
      return {
        title: 'Microphone Access Needed',
        message: 'Microphone permission was denied. Allow access in your browser settings, then try again.',
      };
    case 'NotFoundError':
    case 'DevicesNotFoundError':
      return {
        title: 'No Microphone Found',
        message: 'Connect a microphone or use a device with a built-in mic, then try again.',
      };
    default:
      return {
        title: 'Could Not Start Tuner',
        message: 'Something went wrong while starting audio input. Please try again.',
      };
  }
}

async function startTuner() {
  if (state.isStarting) {
    return;
  }

  if (!PitchDetector.isSupported()) {
    const unsupported = getStartErrorMessage(new Error('unsupported'));
    showError(unsupported.title, unsupported.message);
    return;
  }

  state.isStarting = true;
  setStartButtonsDisabled(true);
  state.detector?.stop();
  state.detector = null;

  const detector = new PitchDetector();
  detector.onPitch = handlePitch;
  detector.onVolume = (rms) => { state.currentVolume = rms; };

  try {
    await detector.start();
    state.detector = detector;
    initReferenceTone(detector.audioContext);
    showApp();
    setGaugeActive(true);
    startAsciiTuner();
    requestWakeLock();
    updateGaugeForSilence();
  } catch (error) {
    detector.stop();
    state.detector = null;
    stopAsciiTuner();
    setGaugeActive(false);
    releaseWakeLock();
    const message = getStartErrorMessage(error);
    showError(message.title, message.message);
  } finally {
    state.isStarting = false;
    setStartButtonsDisabled(false);
  }
}

function bindEvents() {
  getElement('btn-start').addEventListener('click', startTuner);
  getElement('btn-retry').addEventListener('click', startTuner);

  getElement('tuning-select').addEventListener('change', (event) => {
    state.manualLockUntil = 0;
    if (isReferenceTonePlaying()) {
      stopReferenceTone();
      updateRefToneButton(false);
    }
    syncSelectedTuning(event.target.value);
    updateGaugeForSilence();
  });

  getElement('btn-add-tuning').addEventListener('click', openCustomTuningModal);
  getElement('btn-save-tuning').addEventListener('click', handleSaveCustomTuning);
  getElement('btn-modal-close').addEventListener('click', closeCustomTuningModal);
  getElement('btn-ref-tone').addEventListener('click', toggleReferenceTone);

  getElement('modal-overlay').addEventListener('click', (event) => {
    if (event.target === event.currentTarget) {
      closeCustomTuningModal();
    }
  });

  document.addEventListener('keydown', (event) => {
    if (getElement('modal-overlay').classList.contains('hidden')) {
      return;
    }

    if (event.key === 'Escape') {
      closeCustomTuningModal();
      return;
    }

    if (event.key !== 'Tab') {
      return;
    }

    const focusable = getFocusableModalElements();
    if (focusable.length === 0) {
      return;
    }

    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    const active = document.activeElement;

    if (!getElement('modal-overlay').contains(active)) {
      first.focus();
      event.preventDefault();
      return;
    }

    if (event.shiftKey && active === first) {
      last.focus();
      event.preventDefault();
      return;
    }

    if (!event.shiftKey && active === last) {
      first.focus();
      event.preventDefault();
    }
  });
}

function init() {
  initGauge(getElement('tuning-gauge'));
  setGaugeActive(false);
  initAsciiTuner(getElement('ascii-tuner'));
  syncSelectedTuning(getLastTuningId());
  resetCustomTuningForm();
  bindEvents();
  updateGaugeForSilence();
  showStartScreen();
}

init();

function getFocusableModalElements() {
  return Array.from(
    getElement('modal-overlay').querySelectorAll(
      'button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [href], [tabindex]:not([tabindex="-1"])',
    ),
  ).filter((element) => !element.closest('.hidden'));
}

function setStartButtonsDisabled(disabled) {
  getElement('btn-start').disabled = disabled;
  getElement('btn-retry').disabled = disabled;
}
