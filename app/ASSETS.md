# Assets and licenses

Everything bundled in the app, where it came from, and under what license.

| Asset | Source | License |
|---|---|---|
| DM Serif Display, DM Sans, Kalam, Caveat, JetBrains Mono | npm `@fontsource/*` (Google Fonts) | SIL Open Font License 1.1 |
| Noto Color Emoji (all emoji in the app) | npm `@fontsource/noto-color-emoji` (Google) | SIL Open Font License 1.1 |
| App icon, launch screens, share card | Drawn for Postmark in `scripts/build-assets.mjs` (`npm run assets`) | Own work |

Notes
- Emoji always render as Noto, on every device, because Noto is listed first in the font stacks in `src/styles/tokens.css`. The font only covers emoji, and the plain digits, `#` and `*` are removed from its ranges in `src/styles/emoji.css`, so normal text is never affected.
- The emoji font is split into chunks that download only when one of their emoji is shown. They are cached after first use rather than precached.
- No Apple artwork is bundled.
