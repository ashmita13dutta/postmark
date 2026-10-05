# Postmark v2: project spec for Claude Code

Read this whole file before writing code. Items tagged **[D]** were decided by the owner (Ashmita). Items tagged **[P]** are proposed defaults: follow them unless she says otherwise, and flag it if you deviate.

---

## 1. What Postmark is

A journaling app where **every day becomes a postage stamp**. **[D]**

One daily entry produces three distinct layers plus an optional photo:

| Layer | Becomes | Where it shows |
|---|---|---|
| Color of the day (5 colors, poetic names) | The stamp's artwork (bands of color) | Front of the stamp |
| Song of the moment | A purple circular ink **postmark** over the stamp's corner (city, date, song) | Front, overlapping a corner |
| The written moment | A handwritten **postcard** note | Back of the stamp (tap to flip) |
| Photo or photo-booth film strip (optional) | A print **peeking from behind** the stamp | Behind the stamp, at an angle |
| Decorations (stickers, tape, wax seal, doodles) | Their own layer | Postcard back, calendar gaps, album cover |

Keep layers visually distinct: color is shape only, the song is ink only, the moment is handwriting only, decorations never cover the stamp art or postmark.

**The twist [D]:** postcards are **sealed** when written and **delivered on the 1st of the next month** ("mail"). On any date the app also delivers the postcard from **exactly one year ago** ("letter from past you"), and occasionally a random older postcard turns up **"delayed in transit"**.

Sample persona in the design: "Ananya", Kolkata, late monsoon into Durga Puja. Content is fictional. The real owner is a student in Kolkata, so default sample content, city packs, and the first city list should favor Kolkata.

---

## 2. Hard constraints

1. **Zero cost [D].** No paid accounts, no paid APIs, no paid services. No Apple Developer ($99/yr) or Play Console ($25) in v2.
2. **No backend [P].** Local-first: all data lives on the device. Free static hosting only (Cloudflare Pages or GitHub Pages).
3. **No runtime network dependency for core features [P].** Writing, stamping, calendar, mailbox, album, stickers must all work in airplane mode.
4. **Privacy [P].** This is a personal journal. No analytics, no trackers, no third-party scripts, no sending entry text anywhere. Self-host fonts.
5. **iOS-like feel [D].** Smooth spring animations, frosted bars, bottom sheets, safe-area aware, die-cut stickers, emoji support.
6. **Delivery format [P].** Installable PWA. Same code can later be wrapped with Capacitor for an Android APK (sideload) to get real local notifications and haptics. Never write code that blocks that; see `platform.ts` below.

---

## 3. Tech stack [P]

- Vite + React + TypeScript (strict)
- Routing: React Router (tab shell + modal/sheet routes)
- Storage: **Dexie** (IndexedDB). Photos and cutouts stored as Blobs
- PWA: `vite-plugin-pwa` (precache app shell, stickers, fonts; runtime cache for the rest)
- Animation: **Framer Motion** (springs, `layoutId` shared transitions) plus CSS 3D transforms for the postcard flip. Lottie only if a hand-built SVG animation is too costly
- Gestures: `@use-gesture/react` (stickers drag/rotate/pinch, bottom-sheet drag)
- State: Zustand for UI state, Dexie live queries for data
- Zip for export/import: `fflate`
- Images: canvas only (no image libraries unless needed)
- Tests: Vitest (logic), Playwright (mobile viewport 390x844, smoke flows)
- Lint/format: ESLint + Prettier

Before adding any dependency: confirm it is free, permissively licensed, tree-shakeable, and does not phone home.

### Repo layout

```
postmark/
  CLAUDE.md
  ASSETS.md                 # license + source for every font, sound, sticker, icon
  design/                   # the Claude Design mockup html (visual source of truth)
  public/
    stickers/<pack>/<id>.svg + pack.json
    sounds/
    data/ moods.json songs.json cities.json colornames.json festivals.json
  src/
    app/        router, shell, tab bar, theme, install prompt
    screens/    onboarding today reveal postcard calendar mailbox album you
    components/ stamp postmark postcard sticker envelope sheet quilt photo-peek
    engine/     palette.ts mood.ts songs.ts city.ts colorExtract.ts
                seal.ts streak.ts stats.ts rewards.ts
    db/         schema.ts queries.ts export.ts migrations.ts
    lib/        clock.ts platform.ts audio.ts ics.ts share.ts image.ts
    styles/     tokens.css base.css
  tests/
```

### Two abstractions you must build first

- `lib/clock.ts`: the only source of "now". Never call `Date.now()` or `new Date()` directly elsewhere. Supports override via `?now=2026-10-01T09:00` and a dev panel. All date logic (sealing, delivery, year-ago, streaks) is tested through it.
- `lib/platform.ts`: `haptic(kind)`, `notify(...)`, `scheduleReminder(...)`, `share(...)`. PWA implementation first (haptic is a no-op on iOS Safari; vibration only on Android Chrome). A Capacitor implementation can be dropped in later.

---

## 4. Design tokens

The mockup file in `/design` is the visual source of truth. **Read its CSS and copy tokens, font families, spacing, and radii from it** rather than guessing. Known values:

- Paper background: `#F4EFE6` with subtle grain
- Postmark ink purple: `#534AB7` (slightly faded, roughly 85% opacity, like real ink)
- Type: serif headings, a handwriting font for postcard notes, clean sans for UI labels, mono for tiny caps labels. Reuse the exact Google Fonts the mockup uses, self-hosted
- Stamps: perforated edges (SVG mask of circles), slight tilt (seeded random from the date, so it is stable across renders), soft shadow
- Nothing glossy or neon. Tactile, warm, nostalgic
- Bottom tab bar: Today, Calendar, Mailbox, Album, You
- Layout: 390 wide target, fully responsive, safe-area insets on all edges (`env(safe-area-inset-*)`), tap targets at least 44px

Sample color names (use this voice for the name bank): Late Tram Grey, Jhalmuri Orange, Wet Alley Blue, Kadam Yellow, Puja Red.

---

## 5. Data model (Dexie) [P]

All dates are **local-calendar `YYYY-MM-DD` strings** for `day`, and epoch ms for timestamps.

```ts
moments {
  id: string (uuid)
  day: string            // unique index, one stamp per local day
  stampNo: number        // sequential count of stamps ever made
  note: string
  city: string | null
  lat: number | null; lon: number | null
  songTitle: string | null; songArtist: string | null
  songSource: 'own' | 'suggested' | null
  palette: { hex: string; name: string }[5]
  paletteSource: 'moment' | 'photo' | 'manual'
  feeling: string | null          // how the day felt (feelings.json), from the mood engine
  topic: string | null            // what it was about (topics.json), from the mood engine
  sealedUntil: number              // ms, start of delivery day
  openedAt: number | null
  sealedAt: number | null          // set when "Seal & send" is tapped
  createdAt: number; updatedAt: number
}
media { id, momentId, kind: 'single'|'strip', blob, thumb, filter: 'none'|'vintage'|'vibrant', intensity: number, layoutSeed: number }
decorations { id, momentId, stickerId, x, y, rotation, scale, side: 'back'|'front', z }
drawings { momentId, strokes: {color, width, points}[] }          // counts as ONE decoration
seals { momentId, color, emblem: 'heart'|'star'|'moon'|'initial', initial? }
customStickers { id, blob, createdFrom: 'manual'|'auto', createdAt }
unlocks { id, packId, unlockedBy: 'city'|'month'|'streak'|'start', at }
rewards { id, kind: 'golden-stamp'|'complete-month'|'streak-sticker', monthKey?, at }
calendarStickers { id, monthKey: 'YYYY-MM', stickerId|label, x, y }
redeliveries { monthKey, momentId }                              // delayed-in-transit pick, fixed per month
volumes { year, coverStickers: {...}[], closedAt: number|null }
settings { key, value }
```

Settings keys: `homeCity`, `paletteDefault ('moment'|'photo')`, `songModeDefault ('own'|'suggested')`, `deliveryDay (1 to 28, default 1)`, `revealAnimation (bool)`, `reminderTime`, `soundOn`, `hapticsOn`, `appLock`, `onboarded`, `stripFrames (3 or 4, default 3)`.

Derived, never stored: calendar grid, quilt, streaks, stats, medley order. Compute from `moments`.

Migrations: version the schema from day one. Every export includes `schemaVersion`.

---

## 6. Core logic (write these as pure, tested functions)

### 6.1 One stamp per day
`day` is unique. Today's stamp stays editable until it is sealed or the day ends. After sealing, the note is hidden (see 6.2).

### 6.2 Sealing and delivery
- `sealedUntil` = 00:00 local on `deliveryDay` of the **next month** after the moment's day.
- **Sealed** (now < sealedUntil): UI may show stamp art, postmark text, photo peek, and the wax seal dot. It must **not** show the note text, and the song detail is shown only as the postmark text. The note is simply not rendered; this is a UX gate, not security.
- **Delivered** (now >= sealedUntil): appears in the Mailbox as an unopened envelope.
- **Opened**: `openedAt` set when its opening ritual finishes.
- Changing `deliveryDay` recomputes `sealedUntil` for all not-yet-delivered moments.

### 6.3 Mailbox batches
Group delivered moments by month. The headline "Your September has arrived · N postcards" shows the **most recent delivered month with unopened items**; older months stay available below. N is the full count for that month (e.g. 21 stamps means 21 postcards), not a subset. Progress: "X of N opened".

### 6.4 Year-ago letter
For today's date D, find a delivered moment on the same month/day one year earlier. Handle Feb 29 (show on Feb 28 in non-leap years). If found, show: the banner on Today, the envelope badge on the calendar cell, and a special aged envelope in the Mailbox labeled "From <Month> <Year>" that opens to last year's stamp beside this year's.

### 6.5 Delayed in transit
At most one per month. On first Mailbox open of a month, with probability about 50% (seeded by `monthKey`, so reloads never re-roll), pick one **opened** postcard older than 60 days. Persist the choice in `redeliveries`. Presented as a special envelope: torn corner, extra postmarks, apology slip from "the postal service".

### 6.6 Streak
Consecutive local days with a stamp, ending today or yesterday (a streak is not broken until a full day is missed). Also expose: longest streak, "Day N" (day of year), stamp number (sequential), blanks in the current month (past days with no stamp).

### 6.7 Rewards
- Complete-month badge: a past month with zero blank days.
- Golden stamp: a streak of 20+ days.
- Rare sticker: 7-day streak.
- Month sticker pack on delivery: chosen by that month's dominant `topic` or `feeling` (e.g. rain-heavy gives "Monsoon").
- City pack: unlocked from the home city at onboarding and from any new city tagged on a moment.

### 6.8 Calendar grid
Monday-first. Compute the leading offset from the real weekday of the 1st using the date library or `Date` through `clock.ts`. **Never hardcode weekdays.** (Reference check: 1 Sept 2026 is a Tuesday, 24 Sept 2026 is a Thursday, 1 Oct 2026 is a Thursday.) Festival ribbons come from `data/festivals.json` with year-specific dates; verify those dates before shipping and do not invent them.

### 6.9 Stats ("year so far")
Most common color (bucket palette hex by hue family, name the bucket), rainy-day count (`topic === 'rain'`), city counts, top song by (title+artist) with count of stamps.

### 6.10 Volumes
One volume per calendar year. On the first open after 31 Dec, run the closing ceremony once (album closes, final wax seal, moves to shelf, new volume opens). Past volumes stay readable.

---

## 7. Engines (no paid AI) [D constraint, P implementation]

### 7.1 Mood engine (`engine/mood.ts`)
- `moods.json`: about 12 mood families (rain, festival, chai/cozy, exam/pressure, travel, friends, lonely, celebration, nostalgic, sunny, night, food). Each has about 25 keywords, including Bengali/Hinglish words used in Kolkata (e.g. jhalmuri, adda, phuchka, pujo, bristi).
- Score the moment text by keyword hits (lowercase, strip punctuation, light stemming). Tie-break by time of day. Return `{family, tags[]}`. If nothing matches, use time of day and season.

### 7.2 Palette engine (`engine/palette.ts`)
- Each mood family has 3 to 4 base palettes (5 hex each).
- Shift lightness/hue slightly using time of day, season, and (if present) the song's mood tags, so two rainy days do not look identical. Use a seeded RNG from `day` so the result is stable.
- Guarantee 5 distinct colors (minimum perceptual distance, use OKLab) and decent ordering for banding (dark to light or hue sweep).
- Names: `colornames.json` is a bank of poetic names tagged by hue range and lightness; pick the nearest, never duplicate names within one palette.
- **From photo** (`engine/colorExtract.ts`): downscale to about 64px, run median-cut or k-means (k=5), drop near-duplicates, order for banding, then name. Runs fully on-device.
- Any swatch is editable (color picker); name stays editable too. Record `paletteSource`.

### 7.3 Song engine (`engine/songs.ts`)
- `songs.json`: about 150 curated songs, each `{title, artist, moods[], lang}`. Start with a Kolkata-friendly mix (Bengali, Hindi, English).
- "Suggest": score by mood overlap with the moment, return 3 with light randomness; the user can accept, re-roll, or swap.
- "Pick my own": free text title + artist.
- Play button: opens a Spotify search URL (`https://open.spotify.com/search/<q>`) and offers a YouTube search alternative. **Do not use the Spotify API in v2.** "Spotify liked songs" is shown as "coming soon".
- Always store a `songSource` of `own` or `suggested` (drives the source tag).

### 7.4 City engine (`engine/city.ts`)
- `cities.json` (about 150 cities: name, lat, lon, packId). Geolocation permission gives lat/lon; match the nearest city within a threshold, otherwise fall back to a manual search over the list. No geocoding API.
- The matched city decides which **city sticker pack** is shown in the tray (only that city's landmarks).

---

## 8. Screens (build to match the mockup, plus these decided changes)

### 8.1 Onboarding (3 frames) **[D]**
1. "Every day becomes a stamp": a sample stamp builds itself (colors fill, postmark lands, photo slides out).
2. "Your postcards go in the mail": an envelope seals with wax and flies into a mailbox. Line: "You'll open them on the 1st."
3. "Stamp your first moment": choose home city (sets city pack), optional "Connect Spotify" shown as coming soon, then Start into Today. Also ask for location, photos, notification permissions here, each skippable.

### 8.2 Today **[D]**
- Greeting + date, "Day N" with streak, quiet line "September's mail arrives in N days". Year-ago banner if 6.4 applies ("A letter from past you arrived").
- Rotating prompt placeholder ("What happened today?", "What did today smell like?", "Who made you laugh?", "What would you want to remember?") on a lined paper writing box, handwriting font.
- Location chip (auto from GPS, editable).
- **Song, two options**: "Pick my song" and "✦ Suggest from my moment".
- **Photo**: single photo or photo-booth film strip (3 to 4 frames) with a booth-printout look; filter row "Vintage photo booth" and "Vibrant day-out" with an intensity slider.
- **Palette**, segmented toggle: "✦ From my moment + song" or "Mixed from my photo". Five editable swatches. Live preview: swatches gently update as she types (debounced).
- **"Stamp it"** button pinned fully above the tab bar (it was clipped in the mockup; this is a known bug to avoid). On tap: stamper presses down, purple ink print appears, holds, fades over a few seconds, then navigates to Reveal. The ink print must hand off to the postmark via a shared `layoutId`.
- Validation: needs a non-empty note. Photo palette option disabled until a photo exists.

### 8.3 Stamp reveal **[D]**
Approx 3s timeline (ms), springs throughout (stiffness about 260, damping about 20):
- 0: ink print slides to the stamp's top-right corner
- 300: stamp drops from slightly above with soft bounce and wobble, settles tilted
- 600: color bands pour in top to bottom, each with a tiny ripple
- 1000: postmark thumps down (squash, small ink splatter, haptic if available, song begins as a link/play affordance; no autoplay audio from Spotify)
- 1300: photo or strip slides out from behind the stamp at an angle
- 1500: ambient layer: twinkling sparkles, sparse confetti in the day's palette colors (**max 15 pieces**), faint rising music notes from the postmark, 2 to 3 small edge stickers matching the mood. Keep drifting gently after the reveal ends
- 2000: "Today's five" with names and source tag ("✦ from your words" or "from your photo"); song line with tag ("your pick" or "✦ suggested") and a swap button for suggested songs
- 2500: buttons slide up: primary **Flip to read**, secondary **Seal & send**; also a "Sealed until 1 Oct · N days" badge
- "Tap to skip" jumps to the end state. Respect `prefers-reduced-motion` and the `revealAnimation` setting (off means show the end state instantly).
- Animate only `transform` and `opacity`.

### 8.4 Postcard back (decorate) **[D]**
- 3D flip from the stamp to the postcard back, handwritten note, "From: <date>" header, "to future <name>".
- The photo/strip **stays tucked behind and mirrors to the opposite side** on flip (x offset sign flips). It is not taped onto the back.
- Top-right action: **"Seal & send"** (not "Save").
- Bottom sheet tray (draggable, snap points). Tabs: **City** (only the tagged city's landmark stickers, e.g. Kolkata: yellow taxi, tram, Howrah Bridge, rosogolla), **Seals**, **Stamps** (text rubber stamps: FRAGILE, URGENT, HANDLE WITH CARE, RETURN TO SENDER), **Tape**, **Doodles**, **Shapes**, **Draw** (pen; inks pulled from today's palette), **Cutout** (make a sticker from the photo: manual lasso/trace on canvas first, "✦ auto" later and only if a free, license-compatible on-device library exists).
- **Max about 5 decorations per postcard**; the 6th attempt shows a gentle "Your postcard is full" nudge. A drawing layer counts as one.
- Drag, rotate, pinch-resize with `@use-gesture`; random tilt of a few degrees on drop; lift shadow while dragging.
- **Wax seal picker** before sealing: color and emblem (heart, star, moon, initial).
- **Seal & send animation**: postcard folds into an envelope, wax seal presses down, envelope flies toward the Mailbox tab, `sealedAt` set.

### 8.5 Calendar (month sheet) **[D]**
- Header: month name, summary, streak row ("12-day streak · 3 blanks to fill"), prev/next month.
- Grid: Monday-first, correct offset (6.8). Filled days show the stamp (color art). **This month's stamps show a tiny wax-seal dot** (still sealed); past months show opened stamps. Empty past days: faded perforated outline. Future days: blank.
- Days with a photo show a tiny corner of it peeking behind the stamp.
- 📬 badge on dates with a year-ago letter (opens the side-by-side comparison).
- Festival ribbons from `festivals.json`, placed on the **correct week row** (a known bug in the mockup was the ribbon sitting on the wrong row and the date range contradicting the postcard text; do not repeat this).
- Month stickers can be placed in the gaps (festival ribbons, birthday rosettes, "first day of internship" style labels).
- Tap a stamp: it lifts and enlarges into a preview (art, postmark, play button). **Sealed notes do not open from here.**
- Playlist strip: row of postmark rings along the bottom; tapping plays the month's songs in date order as a queue of search links/now-playing highlighting each day's stamp as the queue advances (no audio playback of copyrighted tracks in-app).

### 8.6 Mailbox **[D]**
- Delivery state (see 6.3): header, count, progress, toggle "In order / Shuffle", "▶ Play my month" (auto slideshow through all cards, each showing its song).
- Opening ritual: tap envelope, wax seal cracks, flap opens, postcard slides out with stamp and peeking photo, note appears, song affordance appears. Sets `openedAt`.
- Opened pile on the side; sealed stack with colored wax seals.
- Special envelopes: year-ago (aged, faded paper), delayed in transit (torn corner, extra postmarks, apology slip).
- Rewards shelf: month sticker pack ("New pack unlocked: Monsoon"), golden stamp, complete-month badge (locked/greyed if the month had blanks).
- Between deliveries: faint envelope silhouettes + "Next delivery in N days".

### 8.7 Album (year view) **[D]**
- Bookshelf of volumes (spines: Volume I, II...) at the top; pull one out.
- Decorated cover (stickers unlocked through the year, placeable).
- Color quilt: one cell per day Jan 1 to today (365 max). Tap a cell to lift that day's stamp with peeking photo and song.
- Swipeable row of 12 month sheets; tap opens that month's calendar.
- "Year in postmarks": 12 rings, one per month; tap to play a medley queue (one song per month, or top-played); the matching quilt row glows.
- "This day across years": appears once there are 2 or more volumes (e.g. 24 Sept 2025 beside 24 Sept 2026).
- "Year so far" story card from 6.9.
- Share: formats "Quilt poster", "Postmarks story card", "Favorite stamp", plus the print-album note. Render to PNG via canvas and use the Web Share API with files (`navigator.canShare`), falling back to download.
- Dec 31 ceremony per 6.10.

### 8.8 You (profile) **[D]**
- Postmaster card: name, home city, "member since" stamp, styled like a vintage postal ID.
- Counts: total stamps, longest streak, cities stamped, packs unlocked.
- Sticker collection: unlocked packs, locked packs as faded silhouettes.
- Connections: Spotify (coming soon), location, photos (permission status).
- Preferences: default palette source, default song mode, delivery day, reveal animation on/off, daily reminder time, sound, haptics.
- Privacy: app lock (PIN via WebCrypto-hashed; be honest in the UI that this is a screen lock, not encryption), export, import.

---

## 9. Stickers [D wants high quality; P implementation]

- Format: **SVG**, one folder per pack with a `pack.json` (id, name, kind: `city|aesthetic|reward`, city?, unlock rule, sticker list with tags).
- **Die-cut look** applied automatically by a shared SVG filter: `feMorphology` (dilate) to a white outline, then a soft `feDropShadow`. User cutouts (PNG blobs from canvas) get the same border by compositing a dilated white silhouette behind them.
- Interaction: lift on press (shadow grows), settle with a tiny bounce, random tilt of about plus/minus 4 degrees on drop. Optional glossy shine tied to device orientation (progressive enhancement; skip on denied permission).
- Launch targets: Kolkata pack 12 to 15; aesthetic set about 45 (seals, tape, doodles, shapes, text stamps); reward packs (Monsoon, festival). More cities are post-launch.
- Consistent illustrated style: same stroke weight, same palette family, soft shadows. Draw in Inkscape/Figma; optimize with SVGO. Lazy-load packs; cache after first use.
- Emoji: use system emoji for UI accents only. For anything brand-critical (seal emblems), use custom SVG. Do not bundle Apple's emoji artwork; if a uniform set is needed use an open one (Twemoji, OpenMoji, Noto) and record its license in `ASSETS.md`.

---

## 10. Photos

- Compress on import: longest edge 1600px, JPEG about 0.8; also store a 320px thumbnail.
- Film strip: compose 3 to 4 frames on a canvas into a photo-booth printout (white borders, vertical strip).
- Filters (canvas): **Vintage photo booth** (fade, warm tint, grain, vignette) and **Vibrant day-out** (boosted saturation/contrast). Intensity slider blends original and filtered.
- Peek geometry: photo sits behind the stamp, rotated about -6 to 8 degrees (seeded by `layoutSeed`), offset so about 25 to 35% is visible; sign of the x offset flips on the postcard back.
- Budget: roughly 100 to 200 MB per year of daily photos. Always use thumbnails in the calendar and quilt.

---

## 11. PWA, offline, storage

- Service worker precaches the shell, fonts, base stickers, data JSON. Update flow: prompt "New version ready".
- Call `navigator.storage.persist()` after onboarding. **iOS Safari can evict site data for sites not installed to the home screen**, so show an install prompt (Android: `beforeinstallprompt`; iOS: a short "Share, Add to Home Screen" instruction banner) and gentle backup reminders.
- **Export/import**: a `.zip` with `data.json` (includes `schemaVersion`) plus photos/cutouts as files. Import validates the schema and merges by `day` (ask before overwriting).
- Reminders without a server: generate `.ics` files with `RRULE` (monthly on delivery day: "Your Postmark mail has arrived"; daily at the chosen time). Download via Blob. `platform.ts` can later swap in real local notifications on the Capacitor build.
- Audio must be unlocked after the first user gesture (Safari). Sounds: stamp thud, seal press, paper shuffle, envelope. Small files; user can mute.

---

## 12. iOS-like feel checklist

- Spring animations everywhere, never linear; shared-element transitions via `layoutId` / View Transitions where supported.
- Frosted tab bar and headers: `backdrop-filter: blur()` with a solid fallback.
- Bottom sheets: drag with velocity and snap points.
- Rubber-band overscroll is native; do not disable it. Prevent accidental pull-to-refresh only where it breaks a gesture.
- `font-family` fallback to `-apple-system, system-ui` for UI text that is not part of the brand look.
- Keyboard handling: the writing box must stay visible above the iOS keyboard (test `visualViewport`).
- Limits: no haptics on iOS Safari; no native back-swipe (implement a left-edge swipe-back); audio needs a tap first.
- Performance: transform/opacity only, `will-change` sparingly, confetti capped at 15, reuse elements, test on a low-end Android.
- Accessibility: reduced-motion fallback, 44px targets, text contrast, labels for stamps built from the palette names.

---

## 13. Content to prepare (run alongside code)

| Content | Launch target | When |
|---|---|---|
| Mood word list | about 300 keywords, 12 families, incl. Bengali/Hinglish | Weeks 3 to 4 |
| Base palettes + color names | 3 to 4 palettes per mood, about 200 names | Weeks 3 to 4 |
| Curated songs (mood-tagged) | 150 | Weeks 4 to 6, add as you go |
| City list | about 150 | Week 5 |
| Kolkata sticker pack | 12 to 15 | Weeks 5 to 7 |
| Aesthetic stickers | about 45 | Weeks 6 to 9 |
| Sounds (free-licensed) | 4 to 6 | Week 7 |
| Festival dates | verify per year | Before the calendar ships |

Record the license and source of every asset in `ASSETS.md`. Do not ship an asset without it.

---

## 14. Build order and milestones [P]

| Weeks | Phase | Done when |
|---|---|---|
| 0 | Setup: repo, free hosting, CI deploy of an empty app; `clock.ts`, `platform.ts` | Live link opens on a phone |
| 1 to 2 | Foundation: tokens, fonts, perforated stamp component, tab bar, PWA install | Empty stamp renders from the live link |
| 3 to 6 | Core loop: Today, photo + filters, engines, Reveal, saving | **Milestone 1:** stamp one day end to end |
| 7 to 9 | Postcard: flip, stickers, draw, cutout, wax seal, seal-and-send | A sealed postcard shows in the app |
| 10 to 11 | Time features: calendar, sealing/delivery, mailbox ritual, year-ago, delayed, `.ics` | **Milestone 2:** setting the clock to the 1st unlocks the month |
| 12 to 13 | Album: quilt, stats, share images, export/import | **Milestone 3:** a full seeded year looks good |
| 14 | Onboarding, You, offline audit, install prompt, friend testing | Works on 5 other phones |

### Cut-lines if time runs short (drop in this order)
1. Year medley and "this day across years"
2. Draw tool
3. Film strip (keep single photo)
4. Month stickers on the calendar
5. Delayed-in-transit and rewards shelf

**Never cut:** stamp, postcard back, sealing, 1st-of-month mailbox, calendar, backup.

---

## 15. Testing

- Vitest on all of section 6 using a fake clock: seal/deliver boundaries, deliveryDay changes, Feb 29 year-ago, streak with a missed day, month offsets (including a month starting on Sunday and on Monday), blanks counting, delayed-in-transit determinism.
- Seed script: generate a full fake year of moments (varied palettes, some with photos) for the album, quilt, and stats.
- Playwright at 390x844: onboarding, stamp one day, seal, jump the clock to the 1st, open the mailbox, export then import.
- Manual: airplane mode, install to home screen on Android and iPhone, low-end Android scrolling, keyboard overlap on iOS.

---

## 16. Working agreements for Claude Code

1. Plan first for each phase: list the files you will add or change, then build in small commits.
2. Never call the current time directly; use `clock.ts`. Never hardcode weekdays, month lengths, or festival dates.
3. Do not add runtime network calls, analytics, or paid dependencies. If something seems to need one, stop and ask.
4. Keep logic in `engine/` and `db/` (pure, tested); keep components thin.
5. Before saying a task is done: typecheck, lint, tests, and `vite build` pass; check the screen at 390x844; check reduced-motion.
6. Match the mockup in `/design`. When this file and the mockup disagree, this file wins (it includes fixes to known mockup bugs).
7. Known mockup bugs to avoid: the clipped "Stamp it" button; the calendar's wrong weekday alignment and misplaced festival ribbon; the Mailbox showing 4 envelopes when the month has 21; the Puja date vs "Puja is a week away" contradiction in sample text.

## 17. Open questions to confirm with the owner

- ~~Film strip frame count: 3 or 4?~~ Decided: the user chooses 3 or 4 (setting `stripFrames`, default 3).
- Should delivered postcards be editable after opening, or read-only?
- Whether to produce the optional Capacitor Android APK after launch
- App lock: simple screen lock only, or real encryption of the journal later?
- Final festival list and dates for the calendar ribbons

---

## 18. Status (update as you go)

**Done (foundation):** Vite + React + TS project; PWA config and icons; design tokens from the mockup; self-hosted fonts; `clock.ts` with `?now=` and a dev panel; all date logic with 48 passing tests (also in New York and Auckland time zones); Dexie schema v1 and queries; demo seed; `Stamp`, `StampArt` (4 variants), `Postmark`; tab shell with light versions of Today, Calendar, Mailbox, Album, You.

**Next:** `engine/mood.ts`, `engine/palette.ts`, `engine/colorExtract.ts`, `engine/songs.ts`, `engine/city.ts` with their JSON data; then the real Today screen; then the Stamp reveal animation (Framer Motion). Follow section 14.

**Known gaps to remember:** Bengali script needs a font that supports it (Caveat and Kalam cover Latin only here); `lib/platform.ts` and `lib/ics.ts` are not written yet; no sticker packs yet; the `/dev` route is reachable by URL in production (harmless, but hide it before launch if you like).
