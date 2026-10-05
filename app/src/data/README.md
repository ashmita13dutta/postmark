# Content files (yours to edit)

These JSON files hold the words and colors the app uses. You can edit them in any text editor.
After editing, run `npm test` from the `app` folder: it checks the files and tells you exactly
what is wrong if you break a rule (a missing comma or quote is the usual cause).

JSON rules in one minute: text goes in "double quotes", items are separated by commas, and the
last item in a list has NO comma after it.

---

## moods.json: how the app reads a moment

When you write your note, the app counts which mood family's keywords appear and picks the winner.

- `keywords`: lowercase single words only (no spaces). Add Bengali / Hinglish words spelled the way
  you would type them. Light endings are handled for you: `rain` also matches `raining`, `rains`.
- A word can belong to only ONE family (the tests enforce this).
- `hours`: hours (0 to 23) when this family should win a tie. Only `night` uses it.
- `fallback.monthFamily`: when your note matches nothing, the app picks a mood from the time of
  day (night hours) and then from the month number (1 = January). Change these to suit Kolkata's seasons.

To add a mood family you must also add it to `palettes.json`.

## palettes.json: starting colors for each mood

Each mood has 3 or 4 palettes of exactly 5 colors (hex codes like `#3A5771`). The app picks one,
nudges it slightly using the time of day and season so two rainy days never look identical, and
orders the colors into stamp bands. So design them as moods, not exact final colors.

- `id`: unique, no spaces. `name`: anything you like (only you see it).
- Keep the 5 colors clearly different from each other.
- Nothing neon or glossy: tactile, warm, a little faded, like old stamps.

## colornames.json: the poetic names

Every name is paired with the color it describes. When a stamp has a color, the app finds the
closest-looking entry here and uses its name (never the same name twice on one stamp). So:

- To add a name, give it a hex that really looks like it. More names = better matches.
- Keep names unique. Colors close to an existing name need their own distinct feel.
- Voice: places, food, weather, objects from Kolkata life ("Late Tram Grey", "Jhalmuri Orange").
