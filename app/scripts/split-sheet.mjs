/*
 * Cut a sticker sheet (many stickers on a plain background) into one transparent PNG each.
 *
 *   node scripts/split-sheet.mjs <sheet.jpg> <pack> [--bg auto|white|#rrggbb] [--split 3] [--gap 0]
 *                                [--min-area 500] [--cut x1,y1,x2,y2]
 *
 * The background color is found from the sheet's border by default, so white, off-white and light
 * grey sheets all work. `--tol` (default 14) is how far a pixel may differ from it and still count.
 *
 * Writes app/stickers-src/<pack>/sticker-01.png, sticker-02.png ... in reading order. Look at them,
 * rename the good ones to what they are (candle.png, mug.png), delete the ones you do not want, then
 * run:  node scripts/build-stickers.mjs
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  cropObject,
  cutBackground,
  detectBackground,
  findObjects,
  trimAlpha,
} from './stickers/cutout.mjs'
import { decode, encodePng } from './stickers/image.mjs'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')

function option(name, fallback) {
  const i = process.argv.indexOf(`--${name}`)
  return i > -1 ? Number(process.argv[i + 1]) : fallback
}
function optionText(name, fallback) {
  const i = process.argv.indexOf(`--${name}`)
  return i > -1 ? process.argv[i + 1] : fallback
}
/** --cut x1,y1,x2,y2 (repeatable): a line to cut through stickers that overlap too much to part. */
function cutLines() {
  const lines = []
  process.argv.forEach((a, i) => {
    if (a === '--cut') lines.push(process.argv[i + 1].split(',').map(Number))
  })
  return lines
}
const positional = process.argv
  .slice(2)
  .filter((a, i, all) => !a.startsWith('--') && !all[i - 1]?.startsWith('--'))
const [sheetPath, pack] = positional
if (!sheetPath || !pack) {
  console.error(
    'Usage: node scripts/split-sheet.mjs <sheet.jpg> <pack> [--bg auto|white|#rrggbb] [--split 3] [--gap 0] [--min-area 500] [--cut x1,y1,x2,y2]',
  )
  process.exit(1)
}

const sheet = decode(readFileSync(sheetPath))
// the sheet's own background: found from its border (--bg auto, the default), or given as #rrggbb,
// or "white" for the old near-white rule
const bgOption = optionText('bg', 'auto')
const bg =
  bgOption === 'auto'
    ? detectBackground(sheet.rgba, sheet.width, sheet.height)
    : bgOption === 'white'
      ? null
      : [1, 3, 5].map((i) => parseInt(bgOption.replace('#', '').slice(i - 1, i + 1), 16))
const cutOptions = { bg, tol: option('tol', 14) }
const cut = cutBackground(sheet.rgba, sheet.width, sheet.height, cutOptions)
const { objects, labels } = findObjects(sheet.rgba, sheet.width, sheet.height, {
  ...cutOptions,
  split: option('split', 3),
  cuts: cutLines(),
  gap: option('gap', 0),
  minArea: option('min-area', 500),
})

const dir = resolve(root, 'stickers-src', pack)
mkdirSync(dir, { recursive: true })
objects.forEach((object, i) => {
  const piece = trimAlpha(cropObject(cut, sheet.width, object, labels), 3)
  const name = `sticker-${String(i + 1).padStart(2, '0')}.png`
  writeFileSync(resolve(dir, name), encodePng(piece.width, piece.height, piece.rgba))
})
console.log(
  `${objects.length} stickers from a ${sheet.width}x${sheet.height} sheet -> stickers-src/${pack}/`,
)
