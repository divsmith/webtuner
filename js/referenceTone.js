/** @module referenceTone – plays a sine-wave reference pitch through the speaker */

let _ctx = null;
let _gain = null;
let _osc = null;
let _playing = false;

/**
 * Store the shared AudioContext and create the output GainNode.
 * @param {AudioContext} audioContext
 */
export function init(audioContext) {
  _ctx = audioContext;
  _gain = _ctx.createGain();
  _gain.gain.value = 0;
  _gain.connect(_ctx.destination);
}

/**
 * Start playing a sine wave at the given frequency.
 * If already playing, the current tone is stopped first.
 * @param {number} frequency – target pitch in Hz
 */
export function play(frequency) {
  if (!_ctx) return;

  if (_playing) stop();

  try {
    if (_ctx.state === 'suspended') _ctx.resume();

    _osc = _ctx.createOscillator();
    _osc.type = 'sine';
    _osc.frequency.value = frequency;
    _osc.connect(_gain);

    const now = _ctx.currentTime;
    _gain.gain.setValueAtTime(0, now);
    _gain.gain.linearRampToValueAtTime(0.25, now + 0.08);

    _osc.start();
    _playing = true;
  } catch (_) {
    _playing = false;
  }
}

/**
 * Stop the current tone with a smooth 150 ms release.
 * No-op if nothing is playing.
 */
export function stop() {
  if (!_playing || !_osc) return;

  try {
    const now = _ctx.currentTime;
    _gain.gain.setValueAtTime(_gain.gain.value, now);
    _gain.gain.linearRampToValueAtTime(0, now + 0.15);

    const osc = _osc;
    _osc = null;
    _playing = false;

    setTimeout(() => {
      try {
        osc.stop();
        osc.disconnect();
      } catch (_) { /* already stopped */ }
    }, 150);
  } catch (_) {
    _playing = false;
  }
}

/**
 * @returns {boolean} true if a reference tone is currently sounding
 */
export function isPlaying() {
  return _playing;
}
