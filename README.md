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
| `npm run evaluate` | Measure the built-in (keyword) mood engine on the test corpus |
| `npm run model` | Download the note reader's model (done for you before `dev` and `build`) |
| `npm run train:head` | Retrain the note reader after the labelled notes change (`-- --cv` to cross-check first) |
| `npm run evaluate:model -- file.json` | Score the note reader and the keyword engine on notes it has not seen |
| `npm run assets` | Redraw the app icon, launch screens and share card |

## The note reader (on-device model)

Postmark reads each note in two ways. The built-in way matches words (`feelings.json`, `topics.json`)
and always works, offline, from the first launch. The **note reader** is a small language model
(`e5-small-v2`, about 34 MB) that understands whole sentences, so "Ordinary Friday. Pizza night with
the roommates." reads as content instead of bored. It runs in a web worker on the phone: **your
notes never leave the phone**, and after the first download it works offline.

- It is opt-in. Today asks once, then downloads about 30 MB (the model plus its runtime, compressed;
  about 50 MB of space once unpacked), kept in the browser's cache. You can switch it off or on again
  under You.
- Where it is not available (not downloaded yet, still loading, an old browser) the built-in way is
  used, exactly as before.
- The model is not in git. `npm run model` downloads it from Hugging Face at one pinned revision and
  checks every file's hash (`app/scripts/model/manifest.json`); CI does this on every build.
- The model produces 384 numbers per note. A small "head" (`app/src/data/feelingHead.json`, 57 KB,
  generated, do not edit) turns them into a probability for each of the 16 feelings. Retrain it with
  `npm run train:head` after changing the labelled notes in `app/tests/corpus/`.
- When you tell Postmark a note felt different ("Not quite?"), it keeps the note's words and your
  choice on the phone. A later note that reads almost the same follows your choice. You can copy
  those notes from You and use them as real test notes: save them as `app/tests/corpus/real.json`,
  then `npm run evaluate:model -- tests/corpus/real.json`.

Measured on notes the reader had never seen (two held-out sets, 200 notes): the feeling lands in the
accepted set 83% of the time against 57% for the built-in way, and the right feeling is in the
reader's top three 95% of the time (79% for the built-in way). Those notes were written by the
developer, not by you, so your real notes are the test that counts.

Licenses for every font, emoji set and image: `app/ASSETS.md`.
