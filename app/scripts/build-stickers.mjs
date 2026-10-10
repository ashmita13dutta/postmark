/*
 * Turn your own images into tray stickers.
 *
 *   1. Put images in  app/stickers-src/<pack>/   (PNG, JPG, WebP or SVG; one folder per pack)
 *   2. From the app folder run:   node scripts/build-stickers.mjs
 *
 * PNG and JPG pictures: a white background is removed (if there is one and the image has no
 * transparency yet), the empty edges are trimmed, anything bigger than 256px is shrunk, and a PNG is
 * written into public/stickers/<pack>/.
 * SVG drawings, and WebP pictures that already have a see-through background (up to 1024px), are
 * copied across as they are, so they stay as sharp as you made them.
 *
 * New stickers are added to src/data/sticker-packs.json with a name and search keywords taken from
 * the file name; the names and keywords already in that file are kept, so edit them there freely.
 * A sheet of many stickers? Cut it up first with split-sheet.mjs.
 */
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { basename, dirname, extname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { cutBackground, detectBackground, hasTransparency, trimAlpha } from './stickers/cutout.mjs'
import { svgProblem, svgSize, webpInfo } from './stickers/formats.mjs'
import { decode, encodePng, resize } from './stickers/image.mjs'

// STICKER_ROOT points the script at another folder with the same layout (the tests use this)
const root = process.env.STICKER_ROOT ?? resolve(dirname(fileURLToPath(import.meta.url)), '..')
const SRC = resolve(root, 'stickers-src')
const OUT = resolve(root, 'public/stickers')
const MANIFEST = resolve(root, 'src/data/sticker-packs.json')
const MAX_EDGE = 256
// a see-through WebP is kept as it is up to this size (it cannot be shrunk without a WebP encoder)
const WEBP_MAX_EDGE = 1024
const FILE_WARN_BYTES = 300_000
const IMAGE_EXT = new Set(['.png', '.jpg', '.jpeg', '.webp', '.svg'])
const OUT_EXT = ['png', 'webp', 'svg']

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
        `        { "file": ${q(s.file)}, "label": ${q(s.label)}, "keywords": [${(s.keywords ?? []).map(q).join(', ')}], "w": ${s.w}, "h": ${s.h}${s.ext ? `, "ext": ${q(s.ext)}` : ''} }`,
    )
    const ink = pack.ink ? `      "ink": true,\n` : ''
    return `    {\n      "id": ${q(pack.id)},\n      "label": ${q(pack.label)},\n${ink}      "stickers": [\n${stickers.join(',\n')}\n      ]\n    }`
  })
  const list = packs.length ? `[\n${packs.join(',\n')}\n  ]` : '[]'
  return `{\n  "about": ${q(data.about)},\n  "packs": ${list}\n}\n`
}

/** One source image as finished sticker pixels. */
function prepare(file) {
  let image = decode(readFileSync(file))
  // a sticker on a plain background (white, off-white, light grey): make that see-through
  if (!hasTransparency(image.rgba)) {
    const bg = detectBackground(image.rgba, image.width, image.height)
    if (bg) image = { ...image, rgba: cutBackground(image.rgba, image.width, image.height, { bg }) }
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

/**
 * One source file as { ext, data, width, height } ready to write, or null when it cannot be used.
 * SVG and see-through WebP keep their own format; everything else becomes a PNG.
 */
function build(file) {
  const ext = extname(file).toLowerCase()
  const name = basename(file)
  if (ext === '.svg') {
    const text = readFileSync(file, 'utf8')
    const problem = svgProblem(text)
    if (problem) return console.warn(`  skipped ${name}: ${problem}`)
    const size = svgSize(text)
    if (!size) return console.warn(`  skipped ${name}: it needs a viewBox (or a width and height)`)
    return { ext: 'svg', data: Buffer.from(text), ...size }
  }
  if (ext === '.webp') {
    const data = readFileSync(file)
    const info = webpInfo(data)
    if (info?.alpha && Math.max(info.width, info.height) <= WEBP_MAX_EDGE) {
      if (data.length > FILE_WARN_BYTES)
        console.warn(
          `  note: ${name} is ${Math.round(data.length / 1024)} KB; smaller loads faster`,
        )
      return { ext: 'webp', data, width: info.width, height: info.height }
    }
    // a WebP with a solid background (or an oversized one) is treated like a JPG: cut, trim, shrink
  }
  const image = prepare(file)
  return { ext: 'png', data: encodePng(image.width, image.height, image.rgba), ...image }
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
    const image = build(resolve(SRC, dirName, f))
    if (!image) continue
    // a picture re-made in another format must not leave its old file behind
    for (const other of OUT_EXT) rmSync(resolve(OUT, id, `${stem}.${other}`), { force: true })
    writeFileSync(resolve(OUT, id, `${stem}.${image.ext}`), image.data)
    const ext = image.ext === 'png' ? undefined : image.ext
    const known = pack.stickers.find((s) => s.file === stem)
    if (known) {
      known.w = image.width
      known.h = image.height
      if (ext) known.ext = ext
      else delete known.ext
      updated++
    } else {
      pack.stickers.push({
        file: stem,
        label: titleCase(stem),
        keywords: keywordsFrom(stem),
        w: image.width,
        h: image.height,
        ...(ext ? { ext } : {}),
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
