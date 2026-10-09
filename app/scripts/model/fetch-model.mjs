// Download the note reader's model into public/models/<id>/ (never committed; see .gitignore).
//
//   npm run model             download whatever is missing, verify everything, fail on any problem
//   node scripts/model/fetch-model.mjs --soft    same, but on a network problem only warn (used
//                                               before `npm run dev` so the app still starts
//                                               offline; the reader just stays unavailable)
//   node scripts/model/fetch-model.mjs --check   verify only; exit 1 if anything is missing
//
// Every file is checked against the size and sha256 in manifest.json. A file that does not match
// is deleted, not used.
import { createHash } from 'node:crypto'
import {
  createReadStream,
  createWriteStream,
  existsSync,
  mkdirSync,
  renameSync,
  rmSync,
  statSync,
} from 'node:fs'
import { readFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { Readable } from 'node:stream'
import { pipeline } from 'node:stream/promises'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
export const manifestPath = join(here, 'manifest.json')
export const modelsRoot = join(here, '..', '..', 'public', 'models')

export async function loadManifest() {
  return JSON.parse(await readFile(manifestPath, 'utf8'))
}

export const modelDir = (manifest) => join(modelsRoot, manifest.id)

function sha256OfFile(path) {
  return new Promise((resolve, reject) => {
    const hash = createHash('sha256')
    createReadStream(path)
      .on('data', (chunk) => hash.update(chunk))
      .on('end', () => resolve(hash.digest('hex')))
      .on('error', reject)
  })
}

/** 'ok' when the file is there and exactly right, otherwise why not. */
export async function checkFile(dir, file) {
  const path = join(dir, file.path)
  if (!existsSync(path)) return 'missing'
  if (statSync(path).size !== file.bytes) return 'wrong size'
  return (await sha256OfFile(path)) === file.sha256 ? 'ok' : 'wrong hash'
}

async function download(manifest, file, dir) {
  const { repo, revision } = manifest.source
  const url = `https://huggingface.co/${repo}/resolve/${revision}/${file.path}`
  const target = join(dir, file.path)
  mkdirSync(dirname(target), { recursive: true })
  const part = `${target}.part`
  const response = await fetch(url, { redirect: 'follow' })
  if (!response.ok || !response.body) throw new Error(`${url} answered ${response.status}`)
  const hash = createHash('sha256')
  let bytes = 0
  let lastShown = 0
  const counter = async function* (source) {
    for await (const chunk of source) {
      hash.update(chunk)
      bytes += chunk.length
      if (file.bytes > 5e6 && bytes - lastShown > 4e6) {
        lastShown = bytes
        process.stdout.write(
          `\r  ${file.path}  ${(bytes / 1e6).toFixed(1)} of ${(file.bytes / 1e6).toFixed(1)} MB`,
        )
      }
      yield chunk
    }
  }
  await pipeline(Readable.fromWeb(response.body), counter, createWriteStream(part))
  if (file.bytes > 5e6) process.stdout.write('\n')
  if (bytes !== file.bytes || hash.digest('hex') !== file.sha256) {
    rmSync(part, { force: true })
    throw new Error(
      `${file.path} downloaded but does not match the manifest (size ${bytes}, expected ${file.bytes}). Not using it.`,
    )
  }
  renameSync(part, target)
}

export async function ensureModel({ checkOnly = false } = {}) {
  const manifest = await loadManifest()
  const dir = modelDir(manifest)
  let downloaded = 0
  for (const file of manifest.files) {
    const state = await checkFile(dir, file)
    if (state === 'ok') continue
    if (checkOnly) throw new Error(`${file.path}: ${state}. Run "npm run model".`)
    if (state !== 'missing') rmSync(join(dir, file.path), { force: true })
    console.log(
      `downloading ${file.path} (${(file.bytes / 1e6).toFixed(1)} MB) from ${manifest.source.repo}`,
    )
    await download(manifest, file, dir)
    downloaded++
  }
  return { manifest, dir, downloaded }
}

// run as a script
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const soft = process.argv.includes('--soft')
  const checkOnly = process.argv.includes('--check')
  try {
    const { manifest, downloaded } = await ensureModel({ checkOnly })
    console.log(
      downloaded
        ? `model ${manifest.id} ready (${downloaded} file${downloaded === 1 ? '' : 's'} downloaded and verified)`
        : `model ${manifest.id} already in place and verified`,
    )
  } catch (err) {
    if (soft) {
      console.warn(`\nWarning: the note reader's model is not available (${err.message}).`)
      console.warn(
        'The app still works; it will read notes with the built-in method. Run "npm run model" when online.\n',
      )
    } else {
      console.error(`\n${err.message}`)
      process.exit(1)
    }
  }
}
