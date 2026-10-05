# Content files (yours to edit)

These JSON files hold the words and colors the app uses. Edit them in any text editor, then from
the `app` folder run:

```
npm test          # checks every rule below and names the exact problem if you break one
npm run analyze   # a fuller quality report for palettes and color names
```

JSON in one minute: text goes in "double quotes", items are separated by commas, and the last item
in a list has NO comma after it. A missing comma or quote is the usual mistake.

---

## moods.json: how the app reads a moment

When you write your note, the app counts which mood family's keywords appear and picks the winner.
There are 23 families, from everyday feelings (love, calm, lonely, frustrated, grateful) to
situations (rain, travel, exams, work, fitness, city) and local flavor (Kolkata festivals, food).

- `keywords`: lowercase single words only, letters a-z (no spaces, no apostrophes). Mix English with
  Hindi/Bengali spelled the way you would type them. Light endings are handled for you: `rain` also
  matches `raining` and `rains`.
- A word can belong to only ONE family (tests enforce this). If a word fits two, pick the stronger.
- `hours`: hours (0-23) when this family wins a tie. Only `night` uses it.
- `fallback`: when a note matches nothing, the app picks by time of day (night hours), then by month
  using the `activeProfile`. `generic` suits most places. `kolkata` makes June-September rainy and
  October festive. Add your own profile (for example `southern-hemisphere`) with 12 months.

Adding a family? Also add its palettes in `palettes.json` (3 to 8).

## palettes.json: starting colors for each mood

Each mood has several palettes of exactly 5 hex colors. The app picks one, nudges it using the time
of day and season so two rainy days never look identical, and orders the colors into stamp bands.

- `id`: unique, no spaces. `name`: anything (only you see it). `harmony`: a note on why it works.
- Harmony types used: monochrome (one hue, many lightnesses), analogous (neighbors on the color
  wheel), complementary (opposites, e.g. blue + orange), split-complement and triad (balanced
  three-way), and "neutral + one accent" (calm base, one pop).
- Rules the tests enforce, measured in OKLab (how different colors look to people):
  - no two colors in a palette look alike (distance at least 0.06)
  - enough light-to-dark range for depth (at least 0.3)
  - nothing neon (chroma at most 0.2)
  - every color has a close-matching entry in `colornames.json`
- Tactile, warm, a little faded, like old stamps.

## colornames.json: the poetic names

Every name is paired with the color it describes. When a stamp has a color, the app finds the
closest-looking entry here and uses its name (never the same name twice on one stamp).

- To add a name, give it a hex that really looks like it. More names = better matches.
- Keep names unique, and keep hexes unique. A new palette color needs a name within 0.035 of it:
  `npm run analyze` lists the ones that need one.
- Voice: places, food, weather, objects. Local ("Late Tram Grey", "Jhalmuri Orange") and universal
  ("Sea Glass", "Wet Asphalt", "Oat Milk") sit side by side.
- The tests also require names across the whole color wheel, so add greens, blues and purples as
  generously as reds and oranges.
