# WebTuner

Mobile-first guitar tuner that runs entirely in the browser with microphone input, real-time pitch detection, auto string detection, manual string locking, preset tunings, and custom tunings saved in localStorage.

Live site: https://divsmith.github.io/webtuner

## Features

- Browser-based mic tuner with no app install
- Real-time gauge with cents and in-tune feedback
- Automatic nearest-string detection with debounce
- Manual string selection that temporarily overrides auto-detect
- Built-in guitar tuning presets
- Custom tunings you can save and delete locally
- Static deployment via GitHub Pages

## Local development

This project is plain HTML, CSS, and JavaScript modules.

Serve the folder locally so the browser treats it as a proper module app:

```bash
python3 -m http.server 8000
```

Then open `http://localhost:8000`. Microphone access typically works on `https://` origins and `localhost`, not arbitrary `file://` URLs.

## Browser notes

- Requires microphone permission
- Best experience in current Chrome, Safari, or Edge
- Custom tunings are stored per browser in `localStorage`
