# Postmark

<img src="app/public/icon-512.png" width="120" alt="Postmark app icon" />

A journaling app where every day becomes a postage stamp. Offline-first, zero-cost PWA. Being built from scratch.

## Folder map

| Folder | What's inside |
|---|---|
| `docs/` | `Postmark-v2-spec.md` (full project spec: data model, logic, screens, build order) and `How Postmark works.html` (concept explainer). |
| `design/` | The 6-screen mockup board, the raw Claude Design export, and the v2 foundation mockup. Visual source of truth. |
| `archive/` | Original downloaded zips, untouched. `postmark-v2-foundation.zip` holds the previous app code if you ever want to look at it. |
| `app/` | The new JavaScript build (Vite + React). `cd app && npm install && npm run dev`. |

Stack follows the spec, except plain JavaScript instead of TypeScript.
Try time travel: `http://localhost:5173/?now=2026-10-01T09:00`.

## Install on your phone

Open https://ashmita13dutta.github.io/postmark/ in Safari (iPhone) or Chrome (Android), then Share, Add to Home Screen. It works offline after the first visit.

## Useful commands (run inside `app/`)

| Command | What it does |
|---|---|
| `npm run dev` | Start the app locally |
| `npm test` | Run all tests |
| `npm run lint` | Check the code |
| `npm run evaluate` | Measure mood-engine accuracy on the test corpus |
| `npm run assets` | Redraw the app icon, launch screens and share card |

Licenses for every font, emoji set and image: `app/ASSETS.md`.
