# 🎸 WebTuner

**Free, browser-based guitar tuner — no download, no install.**

**[▶ Open WebTuner](https://divsmith.github.io/webtuner)**

---

## Features

- 🎯 **Real-time pitch detection** — YIN algorithm (de Cheveigné & Kawahara, 2002) running on the Web Audio API
- 🔍 **Auto-string detection** — identifies the nearest string automatically with 3-frame debounce; tap to lock a specific string
- 📊 **Dual-layer visual feedback** — horizontal tuning gauge for directional precision + ASCII art note display for ambient emotional feedback
- 🎵 **9 preset tunings** — Standard, Drop D, Half Step Down, Full Step Down, Drop C, Open G, Open D, Open E, DADGAD
- ✏️ **Custom tunings** — create, save (up to 5), and delete your own tunings, persisted in `localStorage`
- 🔊 **Reference tones** — play the target frequency as a sine wave to hear what the correct pitch sounds like
- 📱 **PWA installable** — add to home screen for a native app feel; works offline after first load
- 🔒 **Wake Lock** — screen stays on while tuning
- 📳 **Haptic feedback** — vibration pulse when you hit in-tune
- 🖥️ **Mobile-first** — safe area insets, responsive layout, touch-optimized, landscape support
- ⚡ **Zero dependencies** — no build step, pure ES modules served directly to the browser (only external dep: `@chenglou/pretext` for character width measurement)
- ♿ **Accessible** — ARIA labels, keyboard navigation, focus trap in modal, reduced motion support

---

## Quick Start

1. Open **[divsmith.github.io/webtuner](https://divsmith.github.io/webtuner)** on your phone
2. Tap **Start Tuning** and grant microphone access
3. Play a string — the tuner detects the note automatically

---

## How It Works

### Pitch Detection

The tuner captures audio via `getUserMedia`, feeds samples through an **AnalyserNode**, and runs the **YIN autocorrelation algorithm** to estimate the fundamental frequency. YIN provides reliable pitch detection even on noisy smartphone microphones.

### Auto-String Detection

Once a pitch is detected, the tuner computes the distance in cents to every string in the active tuning and snaps to the nearest match. A **3-frame debounce** prevents jitter from causing the display to flicker between adjacent strings.

### Visual Feedback

| Layer | Purpose |
|---|---|
| **Horizontal gauge** | Primary directional feedback — shows flat/sharp position at 60 fps via CSS transforms |
| **ASCII art display** | Ambient emotional feedback — large note letterforms with shimmer, color shifts, and ring-wave animations that react to tuning accuracy |

### Haptic Feedback

On supported devices the tuner fires a short vibration pulse the moment the pitch lands in-tune, giving tactile confirmation without requiring you to look at the screen.

---

## Tunings

### Presets

| Tuning | Strings (low → high) |
|---|---|
| Standard | E2 A2 D3 G3 B3 E4 |
| Drop D | D2 A2 D3 G3 B3 E4 |
| Half Step Down | Eb2 Ab2 Db3 Gb3 Bb3 Eb4 |
| Full Step Down | D2 G2 C3 F3 A3 D4 |
| Drop C | C2 G2 C3 F3 A3 D4 |
| Open G | D2 G2 D3 G3 B3 D4 |
| Open D | D2 A2 D3 F#3 A3 D4 |
| Open E | E2 B2 E3 G#3 B3 E4 |
| DADGAD | D2 A2 D3 G3 A3 D4 |

### Custom Tunings

Tap the tuning selector → **Create Custom** → name your tuning and define each string's note. Custom tunings are saved in `localStorage` (up to 5). Delete from the same menu.

---

## Architecture

```
index.html
├── css/styles.css
├── sw.js                    Service worker (offline caching)
└── js/
    ├── app.js               Orchestrator — state, event handlers, render loop
    ├── pitchDetector.js     Web Audio API mic capture + YIN algorithm
    ├── noteUtils.js         Musical math (MIDI ↔ freq, cents, note parsing)
    ├── tunings.js           Preset/custom tuning definitions + localStorage CRUD
    ├── autoDetectState.js   Auto-string-detection debounce logic
    ├── asciiTuner.js        ASCII art renderer (shimmer, color, ring waves)
    ├── noteShapes.js        Bitmap letter definitions for ASCII art
    ├── gauge.js             Horizontal tuning gauge (CSS transforms, 60 fps)
    ├── referenceTone.js     Sine wave oscillator for reference tones
    ├── wakeLock.js          Screen Wake Lock API wrapper
    └── ui.js                DOM rendering, modal, screen state management
```

### Data Flow

```
Microphone → getUserMedia → AnalyserNode → YIN pitch detect
  → noteUtils (freq → note + cents)
  → autoDetectState (debounce string selection)
  → gauge.js (directional indicator)
  → asciiTuner.js (animated note display)
  → referenceTone.js (optional audio output)
```

---

## Development

### Prerequisites

- Any static file server (for ES module support)
- Node.js 22+ (for tests)

### Local Dev Server

```bash
# Option A: Python
python3 -m http.server 8000

# Option B: Node one-liner
npx serve .
```

Then open `http://localhost:8000`. Microphone access requires `https://` or `localhost` — `file://` URLs won't work.

### Running Tests

```bash
npm install   # first time only — installs @chenglou/pretext
npm test      # runs node --test against tests/
```

### Project Structure

```
webtuner/
├── index.html
├── manifest.json
├── sw.js
├── package.json
├── css/
│   └── styles.css
├── js/
│   ├── app.js
│   ├── pitchDetector.js
│   ├── noteUtils.js
│   ├── tunings.js
│   ├── autoDetectState.js
│   ├── asciiTuner.js
│   ├── noteShapes.js
│   ├── gauge.js
│   ├── referenceTone.js
│   ├── wakeLock.js
│   └── ui.js
├── icons/
├── tests/
│   ├── auto-detect.test.js
│   ├── gauge.test.js
│   ├── note-shapes.test.js
│   ├── note-utils.test.js
│   ├── reference-tone.test.js
│   ├── tunings.test.js
│   └── wake-lock.test.js
└── .github/
    └── workflows/
        └── deploy.yml
```

---

## Deployment

Deployment is automated via GitHub Actions (`.github/workflows/deploy.yml`):

1. **Every push to `main`** and every pull request triggers the `test` job (`npm test`)
2. **If tests pass** and the push is on `main`, the `deploy` job copies site assets to the `gh-pages` branch
3. GitHub Pages serves the `gh-pages` branch at `https://divsmith.github.io/webtuner`

No build step — the deploy job copies files directly.

---

## Browser Support

| Browser | Platform | Status |
|---|---|---|
| Chrome / Edge | Android, Desktop | ✅ Full support |
| Safari | iOS 15+, macOS | ✅ Full support |
| Firefox | Android | ✅ Full support |
| Firefox | Desktop | ✅ Full support |

> **Note:** Microphone access requires HTTPS (or `localhost`). The Web Audio API and `getUserMedia` are gated behind a secure context.

---

## License

MIT
