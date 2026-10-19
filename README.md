# STILL — Focus Timer

A deliberately small, mobile-first study timer PWA. Built with plain HTML, CSS and JavaScript; no framework, build step, backend, account or API key.

## Features

- Focus timer with 25, 50 and 90 minute presets, plus custom sessions from 1–180 minutes.
- Start, pause, resume and reset. Sessions of at least one minute are saved when completed or reset early.
- Today’s accumulated focus time, session count, adjustable daily goal and goal progress.
- Seven-day focus chart, daily average and six most recent sessions.
- Saves data in this browser/device with `localStorage`.
- Installable PWA with an app icon, service worker and cached app shell for offline use after the first successful visit.
- Responsive layouts, keyboard Space shortcut to start/pause, and reduced-motion support.

## Repo structure

```text
still-focus-pwa/
├── index.html                 # Page structure and metadata
├── styles.css                 # Swiss/editorial visual system and responsive layout
├── app.js                     # Timer, statistics, local storage and install flow
├── manifest.webmanifest       # PWA name, appearance and icon declarations
├── sw.js                      # Offline app-shell cache
├── vercel.json                # PWA-friendly service-worker headers
├── icons/
│   ├── icon.svg               # Custom S monogram
│   ├── icon-192.png           # Android/PWA icon
│   ├── icon-512.png           # Large PWA icon
│   └── apple-touch-icon.png   # iOS home-screen icon
└── README.md
```

## Deploy to Vercel

1. Download and unzip this folder.
2. Create a GitHub repository and upload the contents of `still-focus-pwa` to the repository root. `index.html` should be at the root, not buried in another folder.
3. In Vercel, choose **Add New → Project**, import the repository, and deploy it as a static site.
4. No build command or environment variables are needed. If Vercel asks for a framework preset, select **Other**; leave the build command empty and the output directory as `.`.
5. Open the HTTPS deployment once while online. The service worker caches the app shell for later offline use.
6. On Android, open the deployed site in Chrome and use the **Install app** prompt/button when it appears, or Chrome’s menu → **Install app** / **Add to Home screen**. On iPhone, open the site in Safari → Share → **Add to Home Screen**.

## Local preview

Because service workers require a secure context, use a local static server rather than opening `index.html` directly. For example, if Python is installed:

```bash
python -m http.server 8080
```

Then open `http://localhost:8080`.

## Data and privacy notes

Focus logs and settings are stored only in the browser’s `localStorage`; they are not uploaded to a server. Browser/site-data clearing, private browsing, or moving to another browser/device can remove or leave this history behind. The Google Fonts stylesheet requires an internet connection on first load; system fallbacks are defined for offline use.

## Design notes

- Palette: warm off-white, near-black and quiet greys only.
- Type: DM Sans for interface text and DM Mono for timer, metrics and editorial labels.
- Approach: Swiss/editorial grid, fine rules, numbered sections, large typographic timer and minimal controls.
