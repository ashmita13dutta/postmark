import { describe, expect, it } from 'vitest'
import { makeGuardedFetch } from '../src/engine/reader/guard'

const answer = (body, { status = 200, type } = {}) =>
  new Response(body, { status, headers: type ? { 'content-type': type } : {} })

describe('the reader’s guarded fetch', () => {
  it('turns a web page answered with 200 into a 404 (a missing file on a host that falls back to its home page)', async () => {
    const fetch = makeGuardedFetch(async () =>
      answer('<!doctype html><title>Postmark</title>', { type: 'text/html; charset=utf-8' }),
    )
    const r = await fetch('/models/e5-small-v2/onnx/model_quantized.onnx')
    expect(r.status).toBe(404)
    expect(r.ok).toBe(false)
  })

  it('does not care how the content type is written', async () => {
    const fetch = makeGuardedFetch(async () => answer('<html>', { type: 'TEXT/HTML' }))
    expect((await fetch('/x')).status).toBe(404)
  })

  it('lets the real files through untouched', async () => {
    for (const type of [
      'application/octet-stream',
      'application/json',
      'application/wasm',
      'text/javascript',
    ]) {
      const real = answer('data', { type })
      const fetch = makeGuardedFetch(async () => real)
      expect(await fetch('/x')).toBe(real)
    }
  })

  it('lets a file with no content type through', async () => {
    const real = answer('data')
    expect(await makeGuardedFetch(async () => real)('/x')).toBe(real)
  })

  it('leaves real errors alone, even if they are pages', async () => {
    const real = answer('<html>Server error</html>', { status: 500, type: 'text/html' })
    const result = await makeGuardedFetch(async () => real)('/x')
    expect(result).toBe(real)
    expect(result.status).toBe(500)
  })

  it('passes the request on exactly as it was given', async () => {
    const seen = []
    const fetch = makeGuardedFetch(async (input, init) => {
      seen.push([input, init])
      return answer('ok', { type: 'application/json' })
    })
    await fetch('/models/a.json', { method: 'GET', headers: { range: 'bytes=0-1' } })
    expect(seen).toEqual([['/models/a.json', { method: 'GET', headers: { range: 'bytes=0-1' } }]])
  })
})
