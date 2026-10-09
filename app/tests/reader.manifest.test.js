import { createHash } from 'node:crypto'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { checkFile, loadManifest } from '../scripts/model/fetch-model.mjs'

describe('the pinned model manifest', () => {
  it('names one exact revision, with a hash and size for every file', async () => {
    const m = await loadManifest()
    expect(m.source.revision).toMatch(/^[0-9a-f]{40}$/)
    expect(m.source.license).toBe('MIT')
    expect(m.files.length).toBeGreaterThanOrEqual(4)
    for (const f of m.files) {
      expect(f.sha256).toMatch(/^[0-9a-f]{64}$/)
      expect(f.bytes).toBeGreaterThan(0)
      expect(f.path).not.toMatch(/^\/|\.\./) // stays inside the model folder
    }
    expect(m.files.some((f) => f.path.endsWith('.onnx'))).toBe(true)
    expect(m.files.some((f) => f.path === 'tokenizer.json')).toBe(true)
  })

  it('uses a plain folder name the worker can find under /models/', async () => {
    const m = await loadManifest()
    expect(m.id).toMatch(/^[a-z0-9][a-z0-9._-]*$/i)
  })
})

describe('checking a downloaded file', () => {
  let dir
  const body = 'hello model'
  const file = {
    path: 'sub/model.bin',
    bytes: Buffer.byteLength(body),
    sha256: createHash('sha256').update(body).digest('hex'),
  }
  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'pm-model-'))
    mkdirSync(join(dir, 'sub'))
  })
  afterEach(() => rmSync(dir, { recursive: true, force: true }))

  it('is "missing" when the file is not there', async () => {
    expect(await checkFile(dir, file)).toBe('missing')
  })
  it('is "ok" for exactly the right file', async () => {
    writeFileSync(join(dir, file.path), body)
    expect(await checkFile(dir, file)).toBe('ok')
  })
  it('catches a file of the wrong size', async () => {
    writeFileSync(join(dir, file.path), `${body} and more`)
    expect(await checkFile(dir, file)).toBe('wrong size')
  })
  it('catches a file of the right size but different content', async () => {
    writeFileSync(join(dir, file.path), 'HELLO MODEL')
    expect(await checkFile(dir, file)).toBe('wrong hash')
  })
})
