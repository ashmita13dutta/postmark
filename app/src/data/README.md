# Content files (yours to edit)

These JSON files hold the words and colors the app uses. Edit them in any text editor, then from
the `app` folder run:

```
npm test          # checks every rule below and names the exact problem if you break one
npm run analyze   # a fuller quality report for palettes, accents and color names
```

JSON in one minute: text goes in "double quotes", items are separated by commas, and the last item
in a list has NO comma after it. A missing comma or quote is the usual mistake.

Preview everything in the app at `/#/palettes` (You tab, "Review palettes, color names and mood words").

---

## The idea: every day has a feeling and a topic

When you write your note, the app asks two questions:

- **How did the day feel?** (`feelings.json`): joyful, tired, anxious, proud...
- **What was it about?** (`topics.json`): shopping, exams, rain, a birthday, your dog...

The **feeling picks the palette**. The **topic swaps in two of its own accent colors**, tuned to the
mood: shopping pink stays candy-bright on a joyful day and goes soft and muted on a tired one.
So "shopping on a happy day" and "shopping on an exhausting day" look different, and so do
"exams on a good day" and "exams on a bad one".

---

## feelings.json

16 feelings (joyful, content, peaceful, dreamy, excited, proud, loving, nostalgic, grateful, tired,
anxious, sad, angry, disappointed, bored, inspired). Each has a `label`, a one-line `blurb`, and
`keywords`. "Disappointed" covers a bad meal, cancelled plans, a ruined day.

- `keywords`: lowercase single words only, letters a-z (no spaces, no apostrophes). Mix English with
  Hindi/Bengali spelled the way you would type them. Light endings are handled for you: `love` also
  matches `loved` and `loves`.
- A word can belong to only ONE feeling or topic, across both files (tests enforce this). If a word
  fits two, give it to the stronger one.
- `defaultFeeling`: used when nothing matches.

### Weak words, phrases and the look of a feeling

- `weak`: a list of keywords that are ambiguous ("quiet", "refreshed", "notes", "spilled"). They
  count for half, so a clearer word elsewhere in the note wins. Use it for words that mean one
  thing in one note and another elsewhere.
- `look`: what a stamp for this feeling should look like, as [min, max] for the average color
  strength (`chroma`) and average `lightness` of its five colors. The tests check every palette,
  and every stamp the engine can build, against it, so a "sad" stamp can never come out
  candy-bright. If you add a palette and the tests say it is outside the envelope, either it
  belongs under another feeling or the envelope should be widened on purpose.
- Phrases are written joined, up to five words: `overthemoon` matches "over the moon", `didntmake`
  matches "didn't make". Idioms like "burnt out", "took me back" and "fell through" work this way.

## topics.json

54 topics in groups (weather & time, everyday life, activities, places & travel, food & drink,
people, occasions). Each has `label`, `group`, `keywords`, and `accents`.

- `defaultFeeling`: the mood this topic usually carries, used only when the note has a topic but no
  feeling words (rain is peaceful, exams are anxious, shopping is joyful). Change it to taste.
- `accents`: exactly 3 hex colors that say "this topic": shopping is pink, yellow and aqua; exams are
  lamp gold, red-pen red and notebook blue. The tests make sure they look clearly different from
  each other and are not neon.
- `hints` (optional): topic words that lean toward a mood even with no feeling word. For example
  `interview` leans anxious and `wedding` leans joyful. A gentle nudge: any real feeling word in the
  note outweighs it. A hint word must be one of the topic's own keywords.
- `weak` (optional): ambiguous topic words that count for half (see above).
- `hours` (optional): hours (0-23) when this topic wins a tie. Only `night` uses it.
- `fallback`: when a note matches no topic, the app picks by time of day, then by month using
  `activeProfile`. `generic` suits most places. `kolkata` makes June-September rainy and October
  festive. Add your own profile (for example a southern-hemisphere one) with all 12 months.

## emoji.json

Emoji count like words: 😍 means loving, 😴 tired, 🎉 party, ☔ rain. Each emoji belongs to one feeling or
one topic. Add the ones you use. Variation selectors (the invisible char after some emoji) are ignored.

## How the engine reads a note (src/engine/mood.js)

- Matches your words, and their forms: `rain` also matches `rains`, `rained`, `raining`. A short word
  is never mistaken for a longer one ("notes" is not "not").
- **Negation:** "not happy" does not count as joyful (it leans disappointed). "Not tired" or "no exams"
  are ignored.
- **The ending matters:** for feelings, later words count a little more, and what comes after "but"
  counts more than what came before. A tie goes to what was said last.
- **Emphasis:** "so happy", an exclamation mark or strong wording make a bright feeling _vivid_ (a
  vivid palette); mild notes stay _soft_. Quiet feelings (tired, sad, calm) are always soft.
- **Topics:** a tie goes to the topic mentioned first (journals usually name their subject up front).
- **Two-word phrases** match as one word: write them joined in the keyword list (`icecream` matches
  "ice cream", `nothinghappened` matches "nothing happened").
- **Nothing matched?** The feeling comes from the topic (`defaultFeeling`), or `content`; the topic
  comes from the time of day (night), then the month (`fallback`).

## palettes.json

Palettes are grouped by feeling. Each has exactly 5 hex colors.

- `id`: unique, no spaces. `name`: anything (only you see it). `harmony`: a note on why it works.
- `energy`: `soft` (warm and a little faded, like old stamps) or `vivid` (bright and cheerful, like
  fresh ink, still not neon). Vivid palettes are allowed stronger colors.
- `topics` (optional): the topics this palette was made for, for example `["autumn"]`,
  `["party"]`, `["dating"]`, `["food"]`. When a day matches that topic, a palette made for it is
  preferred, and the topic's accents are NOT mixed in (the palette already has that flavor). A
  palette with a `topics` tag is never used for an unrelated topic, so a party palette cannot show up
  on a shopping day. Leave `topics` out for a general palette.
- Themed sets include: autumn and winter (warm small-town coffee-shop browns, plaid, pumpkin and maple
  for fall; snowy windows, twinkle lights, cranberry and evergreen for winter), party, dating,
  romance, hangouts with friends, good food, bad food (the `disappointed` feeling), and travel.
- Harmony types used: monochrome (one hue, many lightnesses), analogous (neighbors on the color
  wheel), complementary (opposites, like blue + orange), triad (three balanced hues), and
  "neutrals + one accent".
- Rules the tests enforce, measured in OKLab (how different colors look to people):
  - no two colors look alike (distance at least 0.06)
  - enough light-to-dark range for depth (at least 0.3)
  - soft palettes: color strength at most 0.20. Vivid: at most 0.26, and at least one color
    properly bright (0.15+), otherwise call it soft
  - every color has a close-matching name in `colornames.json`
- Joyful has the most palettes, including the vivid pink + yellow + blue + white "feel-good day" ones.

## shifts.json: the light of the day

After a palette is chosen, it is nudged a little for the **time of day** and the **season**, plus a
tiny seeded wobble from the date, so two rainy days never look identical. Night is a touch darker
and cooler, golden hour (4-7pm) warmer, winter less colorful, summer more.

- `times`: each time-of-day bucket lists its `hours` (every hour 0-23 must belong to exactly one).
- `seasons`: `dL` lighter/darker, `dC` more/less colorful, `warmth` toward orange (+) or blue (-),
  `hue` a few degrees of rotation. Keep these small: it is a nudge, not a repaint.
- `profiles`: which month is which season. `kolkata` has a monsoon (June-September);
  `generic` has spring, summer, autumn and winter. Add your own with all 12 months, and give it the
  same name in `topics.json` `fallback.profiles`.
- `jitter`: the day-to-day wobble. `strength`: 1 is normal, 0 turns all shifts off.
- Safety: if a shift would make two colors look alike or too strong, it is eased back (half, then a
  quarter, then none), so it can never spoil a palette. The tests check this for every palette at
  every time of day in every season.

## colornames.json

Every name is paired with the color it describes. When a stamp has a color, the app finds the
closest-looking entry here and uses its name (never the same name twice on one stamp).

- To add a name, give it a hex that really looks like it. More names = better matches.
- Keep names unique, and keep hexes unique. A new palette or accent color needs a name within 0.035
  of it: `npm run analyze` lists the ones that still need one.
- Voice: places, food, weather, objects. Local ("Late Tram Grey", "Jhalmuri Orange") and universal
  ("Sea Glass", "Candy Window Pink", "Oat Milk") sit side by side.
- The tests also require names across the whole color wheel.

## Measuring how well it reads notes

`npm run evaluate` runs the mood engine over about 450 realistic notes (`tests/corpus/*.json`:
English, Hinglish and Bengali, short and long, mixed feelings, emoji, typos) and prints the score and
every miss:

- **feels-right**: the answer is the same _kind_ of feeling (positive, neutral, negative) as an
  accepted one. This is what the color mostly depends on.
- **flips**: a positive note got a negative palette, or the reverse. This is the mistake that ruins a
  stamp, and the tests require zero on the development notes.
- **feeling / topic / both**: exact matches.

Tuning on a set always flatters its score, so a new batch of notes is written fresh, checked once for
an honest number, and only then added to the development sets. The honest first-run numbers so far
are recorded at the top of `tests/corpus/dev2.json` and `dev3.json`. Your own real notes are the best
test: add the ones that read wrong as `["the note", "the feeling it should be", "the topic"]`.

## tints.json: words that ask for a color

Some words name a color without naming a feeling: "morning breeze" is bright blue, "golden hour" is amber, "chai" is brown. Each entry is `{ name, color, words }`. Phrases are written joined and lowercase ("morningbreeze"); the engine tries up to five joined words, and generates plural/-ing forms of single words.

- A phrase, a word you taught, or the same color asked for twice is **strong**: the stamp keeps the palette's darkest and lightest colors (they carry the mood) and builds the middle bands from shades of that color.
- A single passing word is **soft**: the color is simply the closest-matching palette plus an accent.
- "no breeze" turns it off. Up to two clearly different colors per note.
- The color is toned a little toward the mood, and never past the strength the feeling's look allows, so a sad breezy morning is still a quiet blue.
- In the app, "This felt different" → "Its color" lets you tie any word to a preset or your own color.

## Teaching the app your words

Open the review page (You, then "Review palettes, color names and mood words"), go to **Note**, and
type a note. If it reads wrong, tap **This felt different**:

1. Choose **How it felt** or **What it was about**, then pick the right one.
2. Tap the words in your note that show it. Dim words are ones the app already understands. Words you
   tap next to each other become one phrase ("passed away"). **Pick the words it doesn't know**
   selects the unfamiliar ones for you.
3. Tap **Teach it**. The note is read again straight away.

What you taught is saved **on this phone only** and listed under **My words**, where each word has a
**×** to take it back. Taught words:

- win over the built-in meaning (teach "quiet" as sad and it is sad for you),
- count a little extra, because you chose them on purpose,
- also match their usual forms (teach "zonk" and "zonked" works), though a phrase matches exactly,
- are stored in the `lexicon` table of the phone's database, not in these files.

To make a word part of the app for everyone (and for the tests), add it to `feelings.json` or
`topics.json` instead. Words from "My words" are a good source of candidates.

---

## sticker-packs.json: the postcard stickers

The decorate tray on the back of a postcard has a row of tabs: **Recent**, **Saved**, then one tab per
pack, then the drawn **Stamps**, **Tape** and **Doodles**. The packs come from this file. You make
them from your own pictures.

**Adding stickers**

1. Make a folder per pack inside `app/stickers-src/` and put images in it: `stickers-src/cozy/candle.png`.
   PNG, JPG or WebP all work. If a picture sits on a plain background (white, off-white or light grey), the background is removed for you.
2. From the `app` folder run `node scripts/build-stickers.mjs`. It trims and shrinks each image (no
   bigger than 256px on the long side), saves it under `public/stickers/`, and adds anything new to
   this file.
3. Open this file and tidy the entries it added. Each sticker looks like:

   `{ "file": "candle", "label": "Candle", "keywords": ["candle", "light", "warm"], "w": 117, "h": 129 }`

   - `file` is the image name without `.png`, lowercase letters, digits and dashes only. Leave it alone.
   - `label` is the name (screen readers read it, and search matches it).
   - `keywords` are what the **search box** matches. Add every word you might type: "tea", "chai", "kettle".
   - `w` and `h` are filled in by the script.
   - A pack's `label` is the tab name, and the order of packs here is the order of the tabs.

Running the script again is safe: your labels and keywords are kept, only new pictures are added.

**A sheet with many stickers on it?** Cut it into single stickers first:
`node scripts/split-sheet.mjs sheet.jpg cozy` writes `stickers-src/cozy/sticker-01.png`, `sticker-02.png`
and so on. Look at them, rename the good ones (`candle.png`), delete the rest, then run the build script.
If two stickers touch and come out as one, run it again with `--split 4` (separates things that only
touch) or draw a cut between them with `--cut x1,y1,x2,y2`. The sheet's background color is found
automatically (white, off-white and light grey all work). Thin shiny things like chrome sparkles and
wire clips need a gentler cut: `--tol 6 --split 0 --gap 8`. White objects on a white sheet (a white
cup) can lose their edges, so check the results before you build.

**Only use pictures you have the right to use.** This app is published on a public website, so whatever
you put in `public/stickers/` is public too.

**The look of a sticker.** Tap a sticker on the card and, under the toolbar, you can switch its white
die-cut edge on or off, and wash a picture sticker in a tone (Original, Cream, Cocoa, Rose, Sage, Mono).
The tones, and the colors in each, are listed in `src/data/stickers.js` (`TONES`). The last look you
chose is what the next sticker starts with, so a card can share one cozy palette.

---

## feelingHead.json (generated: do not edit)

The note reader (the on-device language model, see the main README) turns a note into 384 numbers.
`feelingHead.json` holds the last layer that turns those numbers into a probability for each of the
16 feelings. It is **generated** from the labelled notes in `tests/corpus/`, so it is not edited by
hand like the other files here. To change what the reader thinks:

1. add or fix labelled notes in `tests/corpus/` (one note per line: `["text", ["feeling", ...], ["topic", ...]]`),
2. run `npm run train:head` (add `-- --cv` to see a cross-validated score first),
3. run `npm test`, which checks the file still matches the model in `scripts/model/manifest.json`.

The built-in keyword method (`feelings.json` and the rest of this page) is unaffected. It still
supplies the topic, color words, anything you taught, and the whole reading when the reader is off.
