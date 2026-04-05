import { TUNER_MAX_FREQ, TUNER_MIN_FREQ } from './noteUtils.js';

/**
 * pitchDetector.js — Web Audio API microphone capture + YIN pitch detection
 *
 * Usage:
 *   const detector = new PitchDetector();
 *   detector.onPitch = (hz) => { /* hz is null when silent *\/ };
 *   await detector.start(); // may throw on mic denial / unsupported browser
 *   detector.stop();
 */

const BUFFER_SIZE    = 2048;
const RMS_THRESHOLD  = 0.008;  // ignore frames below this RMS (silence / noise floor)
const YIN_THRESHOLD  = 0.12;   // lower = stricter, 0.10–0.15 is typical

export class PitchDetector {
  static isSupported() {
    return Boolean(
      typeof navigator !== 'undefined'
      && navigator.mediaDevices?.getUserMedia
      && typeof window !== 'undefined'
      && (window.AudioContext || window.webkitAudioContext),
    );
  }

  constructor() {
    this._ctx      = null;
    this._analyser = null;
    this._stream   = null;
    this._buffer   = new Float32Array(BUFFER_SIZE);
    this._rafId    = null;
    this._running  = false;
    this._handleVisibilityChange = () => {
      if (!this._running || document.hidden) return;
      if (this._ctx?.state === 'suspended') {
        this._ctx.resume().catch(() => {});
      }
    };
    /** @type {((hz: number | null) => void) | null} */
    this.onPitch   = null;
    /** @type {((rms: number) => void) | null} */
    this.onVolume  = null;
  }

  /** @returns {AudioContext|null} The underlying AudioContext, for sharing with other audio modules. */
  get audioContext() {
    return this._ctx;
  }

  async start() {
    // Disable processing that can distort pitch
    this._stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: false,
        noiseSuppression: false,
        autoGainControl:  false,
      },
      video: false,
    });

    this._ctx = new (window.AudioContext || window.webkitAudioContext)();

    // iOS may start in 'suspended' state even after a user gesture; resume it
    if (this._ctx.state === 'suspended') {
      await this._ctx.resume();
    }

    const source      = this._ctx.createMediaStreamSource(this._stream);
    this._analyser    = this._ctx.createAnalyser();
    this._analyser.fftSize               = BUFFER_SIZE;
    this._analyser.smoothingTimeConstant = 0; // raw samples — no smoothing for YIN

    source.connect(this._analyser);
    this._running = true;
    document.addEventListener('visibilitychange', this._handleVisibilityChange);
    this._loop();
  }

  stop() {
    this._running = false;
    document.removeEventListener('visibilitychange', this._handleVisibilityChange);
    if (this._rafId) cancelAnimationFrame(this._rafId);
    this._stream?.getTracks().forEach(t => t.stop());
    this._ctx?.close();
    this._rafId = null;
    this._stream = null;
    this._ctx = null;
  }

  _loop() {
    if (!this._running) return;
    this._rafId = requestAnimationFrame(() => this._loop());
    if (document.hidden) return; // save battery when tab is backgrounded

    this._analyser.getFloatTimeDomainData(this._buffer);

    const rms = this._rms(this._buffer);
    this.onVolume?.(rms);
    if (rms < RMS_THRESHOLD) {
      this.onPitch?.(null);
      return;
    }

    const freq = this._yin(this._buffer, this._ctx.sampleRate);
    this.onPitch?.(freq);
  }

  _rms(buf) {
    let sum = 0;
    for (let i = 0; i < buf.length; i++) sum += buf[i] * buf[i];
    return Math.sqrt(sum / buf.length);
  }

  /**
   * YIN pitch detection algorithm.
   * Reference: de Cheveigné & Kawahara (2002), JASA 111(4).
   *
   * @param {Float32Array} buffer   — PCM time-domain samples
   * @param {number}       sampleRate
   * @returns {number|null}         — fundamental frequency in Hz, or null if not found
   */
  _yin(buffer, sampleRate) {
    const minTau  = Math.floor(sampleRate / TUNER_MAX_FREQ); // ~105 at 44100 Hz
    const maxTau  = Math.ceil(sampleRate / TUNER_MIN_FREQ);  // ~678 at 44100 Hz
    const halfLen = buffer.length >> 1;                // 1024

    if (maxTau >= halfLen) return null; // buffer too small for this freq range

    // ── Step 1: Difference function ─────────────────────────
    // d[τ] = Σ_j (x[j] - x[j+τ])²
    const diff = new Float32Array(maxTau + 1);
    for (let tau = 1; tau <= maxTau; tau++) {
      let sum = 0;
      for (let j = 0; j < halfLen; j++) {
        const delta = buffer[j] - buffer[j + tau];
        sum += delta * delta;
      }
      diff[tau] = sum;
    }

    // ── Step 2: Cumulative Mean Normalized Difference (CMND) ─
    // d'[τ] = d[τ] · τ / Σ_{j=1}^{τ} d[j]
    const cmnd = new Float32Array(maxTau + 1);
    cmnd[0] = 1;
    let runningSum = 0;
    for (let tau = 1; tau <= maxTau; tau++) {
      runningSum += diff[tau];
      cmnd[tau] = runningSum > 0 ? (diff[tau] * tau) / runningSum : 1;
    }

    // ── Step 3: Absolute threshold ───────────────────────────
    // Find first τ in [minTau, maxTau) where CMND < threshold,
    // then slide to local minimum.
    let bestTau = -1;
    for (let tau = minTau; tau < maxTau; tau++) {
      if (cmnd[tau] < YIN_THRESHOLD) {
        while (tau + 1 < maxTau && cmnd[tau + 1] < cmnd[tau]) tau++;
        bestTau = tau;
        break;
      }
    }

    if (bestTau === -1) return null;

    // ── Step 4: Parabolic interpolation for sub-sample accuracy
    if (bestTau > 0 && bestTau < maxTau) {
      const a = cmnd[bestTau - 1];
      const b = cmnd[bestTau];
      const c = cmnd[bestTau + 1];
      const denom = 2 * (2 * b - a - c);
      if (Math.abs(denom) > 1e-10) {
        bestTau += (c - a) / denom;
      }
    }

    return sampleRate / bestTau;
  }
}
