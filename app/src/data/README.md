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

14 feelings. Each has a `label`, a one-line `blurb`, and `keywords`.

- `keywords`: lowercase single words only, letters a-z (no spaces, no apostrophes). Mix English with
  Hindi/Bengali spelled the way you would type them. Light endings are handled for you: `love` also
  matches `loved` and `loves`.
- A word can belong to only ONE feeling or topic, across both files (tests enforce this). If a word
  fits two, give it to the stronger one.
- `defaultFeeling`: used when nothing matches.

## topics.json

54 topics in groups (weather & time, everyday life, activities, places & travel, food & drink,
people, occasions). Each has `label`, `group`, `keywords`, and `accents`.

- `accents`: exactly 3 hex colors that say "this topic": shopping is pink, yellow and aqua; exams are
  lamp gold, red-pen red and notebook blue. The tests make sure they look clearly different from
  each other and are not neon.
- `hours` (optional): hours (0-23) when this topic wins a tie. Only `night` uses it.
- `fallback`: when a note matches no topic, the app picks by time of day, then by month using
  `activeProfile`. `generic` suits most places. `kolkata` makes June-September rainy and October
  festive. Add your own profile (for example a southern-hemisphere one) with all 12 months.

## palettes.json

Palettes are grouped by feeling. Each has exactly 5 hex colors.

- `id`: unique, no spaces. `name`: anything (only you see it). `harmony`: a note on why it works.
- `energy`: `soft` (warm and a little faded, like old stamps) or `vivid` (bright and cheerful, like
  fresh ink, still not neon). Vivid palettes are allowed stronger colors.
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

## colornames.json

Every name is paired with the color it describes. When a stamp has a color, the app finds the
closest-looking entry here and uses its name (never the same name twice on one stamp).

- To add a name, give it a hex that really looks like it. More names = better matches.
- Keep names unique, and keep hexes unique. A new palette or accent color needs a name within 0.035
  of it: `npm run analyze` lists the ones that still need one.
- Voice: places, food, weather, objects. Local ("Late Tram Grey", "Jhalmuri Orange") and universal
  ("Sea Glass", "Candy Window Pink", "Oat Milk") sit side by side.
- The tests also require names across the whole color wheel.
