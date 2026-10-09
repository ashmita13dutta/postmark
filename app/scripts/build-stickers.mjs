/*
 * Turn your own images into tray stickers.
 *
 *   1. Put images in  app/stickers-src/<pack>/   (PNG, JPG or WebP; one folder per pack)
 *   2. From the app folder run:   node scripts/build-stickers.mjs
 *
 * For each image it removes a white background (if there is one and the image has no transparency
 * yet), trims the empty edges, shrinks anything bigger than 256px, and writes a PNG into
 * public/stickers/<pack>/. New stickers are added to src/data/sticker-packs.json with a name and
 * search keywords taken from the file name; the names and keywords already in that file are kept,
 * so edit them there freely. A sheet of many stickers? Cut it up first with split-sheet.mjs.
 */
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { basename, dirname, extname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { cornersAreLight, cutBackground, hasTransparency, trimAlpha } from './stickers/cutout.mjs'
import { decode, encodePng, resize } from './stickers/image.mjs'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const SRC = resolve(root, 'stickers-src')
const OUT = resolve(root, 'public/stickers')
const MANIFEST = resolve(root, 'src/data/sticker-packs.json')
const MAX_EDGE = 256
const IMAGE_EXT = new Set(['.png', '.jpg', '.jpeg', '.webp'])

/** 'Warm Candle!.png' -> 'warm-candle' */
const slug = (name) =>
  name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')

const titleCase = (text) => {
  const spaced = text.replace(/[-_]+/g, ' ').trim()
  return spaced.charAt(0).toUpperCase() + spaced.slice(1)
}

/** Search keywords from a file name: its words, without numbers or filler. */
const keywordsFrom = (stem) =>
  stem.split('-').filter((w) => w.length > 1 && !/^\d+$/.test(w) && w !== 'sticker')

const q = (value) => JSON.stringify(value)

/** The manifest as text, one sticker per line, so it stays easy to read and edit by hand. */
function formatManifest(data) {
  const packs = data.packs.map((pack) => {
    const stickers = pack.stickers.map(
      (s) =>
        `        { "file": ${q(s.file)}, "label": ${q(s.label)}, "keywords": [${(s.keywords ?? []).map(q).join(', ')}], "w": ${s.w}, "h": ${s.h} }`,
    )
    return `    {\n      "id": ${q(pack.id)},\n      "label": ${q(pack.label)},\n      "stickers": [\n${stickers.join(',\n')}\n      ]\n    }`
  })
  const list = packs.length ? `[\n${packs.join(',\n')}\n  ]` : '[]'
  return `{\n  "about": ${q(data.about)},\n  "packs": ${list}\n}\n`
}

/** One source image as finished sticker pixels. */
function prepare(file) {
  let image = decode(readFileSync(file))
  // a sticker exported on white: make the white see-through
  if (!hasTransparency(image.rgba) && cornersAreLight(image.rgba, image.width, image.height)) {
    image = { ...image, rgba: cutBackground(image.rgba, image.width, image.height) }
  }
  image = trimAlpha(image, 3)
  const longest = Math.max(image.width, image.height)
  if (longest > MAX_EDGE) {
    const k = MAX_EDGE / longest
    image = resize(
      image,
      Math.max(1, Math.round(image.width * k)),
      Math.max(1, Math.round(image.height * k)),
    )
  }
  return image
}

if (!existsSync(SRC)) {
  console.error(`No stickers-src folder yet. Create ${SRC}/<pack>/ and put your images in it.`)
  process.exit(1)
}

const manifest = JSON.parse(readFileSync(MANIFEST, 'utf8'))
let added = 0
let updated = 0

const packDirs = readdirSync(SRC, { withFileTypes: true })
  .filter((d) => d.isDirectory() && !/^[._]/.test(d.name))
  .map((d) => d.name)
  .sort()

for (const dirName of packDirs) {
  const id = slug(dirName)
  let pack = manifest.packs.find((p) => p.id === id)
  if (!pack) {
    pack = { id, label: titleCase(dirName), stickers: [] }
    manifest.packs.push(pack)
  }
  const files = readdirSync(resolve(SRC, dirName))
    .filter((f) => IMAGE_EXT.has(extname(f).toLowerCase()))
    .sort()
  mkdirSync(resolve(OUT, id), { recursive: true })
  const used = new Set()
  for (const f of files) {
    let stem = slug(basename(f, extname(f))) || 'sticker'
    for (let n = 2; used.has(stem); n++) stem = `${stem.replace(/-\d+$/, '')}-${n}`
    used.add(stem)
    const image = prepare(resolve(SRC, dirName, f))
    writeFileSync(resolve(OUT, id, `${stem}.png`), encodePng(image.width, image.height, image.rgba))
    const known = pack.stickers.find((s) => s.file === stem)
    if (known) {
      known.w = image.width
      known.h = image.height
      updated++
    } else {
      pack.stickers.push({
        file: stem,
        label: titleCase(stem),
        keywords: keywordsFrom(stem),
        w: image.width,
        h: image.height,
      })
      added++
    }
  }
  // listed in the manifest but no longer in the folder: keep them, but say so
  for (const s of pack.stickers) {
    if (!used.has(s.file)) console.warn(`  note: ${id}/${s.file} is listed but has no source image`)
  }
}

writeFileSync(MANIFEST, formatManifest(manifest))
const total = manifest.packs.reduce((n, p) => n + p.stickers.length, 0)
console.log(
  `${added} added, ${updated} updated. ${manifest.packs.length} packs, ${total} stickers.`,
)
