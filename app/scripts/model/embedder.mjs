// Runs the note reader's model in Node (for training and evaluation), with a disk cache so notes
// are only embedded once per model. Uses exactly the files public/models/<id>/ that the app ships,
// so the vectors here are the vectors the phone computes.
import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join, sep } from 'node:path'
import { fileURLToPath } from 'node:url'
import { env, pipeline } from '@huggingface/transformers'
import { ensureModel, modelsRoot } from './fetch-model.mjs'

const cacheDir = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '.cache')

const sha1 = (s) => createHash('sha1').update(s).digest('hex')
const round = (v) => Math.round(v * 1e5) / 1e5

export async function createNodeEmbedder() {
  // refuses to run on a missing or altered model
  const { manifest } = await ensureModel({ checkOnly: true })
  const modelFile = manifest.files.find((f) => f.path.endsWith('.onnx'))
  const cachePath = join(
    cacheDir,
    `embeddings-${modelFile.sha256.slice(0, 12)}-${sha1(manifest.prefix).slice(0, 6)}.json`,
  )
  const cache = existsSync(cachePath) ? JSON.parse(readFileSync(cachePath, 'utf8')) : {}
  let extractor = null
  let dirty = false

  async function load() {
    if (extractor) return extractor
    env.allowRemoteModels = false
    env.allowLocalModels = true
    env.localModelPath = modelsRoot + sep
    extractor = await pipeline('feature-extraction', manifest.id, { dtype: manifest.dtype })
    return extractor
  }

  /** Unit-length sentence embeddings for each text, in order. */
  async function embedAll(texts) {
    const out = new Array(texts.length)
    const todo = []
    texts.forEach((text, i) => {
      const hit = cache[sha1(text)]
      if (hit) out[i] = hit
      else todo.push(i)
    })
    if (todo.length) {
      const model = await load()
      for (let k = 0; k < todo.length; k += 16) {
        const batch = todo.slice(k, k + 16)
        const result = await model(
          batch.map((i) => manifest.prefix + texts[i]),
          { pooling: manifest.pooling, normalize: true },
        )
        result.tolist().forEach((v, j) => {
          const vec = v.map(round)
          out[batch[j]] = vec
          cache[sha1(texts[batch[j]])] = vec
        })
        dirty = true
      }
    }
    if (dirty) {
      mkdirSync(cacheDir, { recursive: true })
      writeFileSync(cachePath, JSON.stringify(cache))
      dirty = false
    }
    return out
  }

  return { manifest, embedAll, embedded: () => Object.keys(cache).length }
}
