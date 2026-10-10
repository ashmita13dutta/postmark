# Assets and licenses

Everything bundled in the app, where it came from, and under what license.

| Asset | Source | License |
|---|---|---|
| DM Serif Display, DM Sans, Kalam, Caveat, JetBrains Mono | npm `@fontsource/*` (Google Fonts) | SIL Open Font License 1.1 |
| Noto Color Emoji (all emoji in the app) | npm `@fontsource/noto-color-emoji` (Google) | SIL Open Font License 1.1 |
| App icon, launch screens, share card | Drawn for Postmark in `scripts/build-assets.mjs` (`npm run assets`) | Own work |
| Sticker packs: 38 PNG stickers in `public/stickers/` (Cozy, Café, Autumn & winter, Sweet, Memories & travel), cut from a sticker sheet the owner supplied with `scripts/split-sheet.mjs`; two items with brand names on them were left out | Owner-supplied sheet; the original maker is not recorded | The owner confirmed on 2026-10-09 that they may use it in this app |
| Sticker packs, second batch: 146 more PNG stickers (Post & letters, Cherry red, Pink, Matcha green, Blue, Sunshine yellow, Vintage gold, Chrome & Y2K, Journal bits, plus additions to Cozy, Café, Sweet and Memories & travel), cut from nine sheets the owner supplied; items showing brand names or licensed characters were left out | Owner-supplied sheets; the original makers are not recorded | The owner confirmed on 2026-10-10 that they may use them in this app |
| Real wax seal and envelope paper: `public/wax/seal-rose.png` (a rose wax seal photograph, cut out and resized) and `public/wax/paper.png` (a patch of aged, creased paper cropped from an envelope photograph), both supplied by the owner; the seal is recoloured in the app | Owner-supplied photographs; the original maker is not recorded | The owner confirmed on 2026-10-10 that they may use them in this app |
| Note reader model: e5-small-v2, int8 ONNX conversion by Xenova (downloaded by `npm run model`, pinned in `scripts/model/manifest.json`, not committed) | Hugging Face `Xenova/e5-small-v2`, from `intfloat/e5-small-v2` (Wang et al., Microsoft) | MIT |
| Model runtime: Transformers.js and ONNX Runtime Web (npm `@huggingface/transformers`, `onnxruntime-web`) | Hugging Face, Microsoft | Apache-2.0 and MIT |

Notes
- Emoji always render as Noto, on every device, because Noto is listed first in the font stacks in `src/styles/tokens.css`. The font only covers emoji, and the plain digits, `#` and `*` are removed from its ranges in `src/styles/emoji.css`, so normal text is never affected.
- The emoji font is split into chunks that download only when one of their emoji is shown. They are cached after first use rather than precached.
- No Apple artwork is bundled.
