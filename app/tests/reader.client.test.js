import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  STALL_MS,
  classify,
  configureReaderForTests,
  getReaderState,
  startReader,
  stopReader,
  subscribeReader,
} from '../src/engine/reader/client'
import { HEAD } from '../src/engine/reader/head'

// a stand-in for the web worker: tests decide what the model "says" and when
class FakeWorker {
  static all = []
  constructor() {
    this.sent = []
    this.terminated = false
    FakeWorker.all.push(this)
  }
  postMessage(message) {
    this.sent.push(message)
  }
  terminate() {
    this.terminated = true
  }
  say(message) {
    this.onmessage({ data: message })
  }
  embeds() {
    return this.sent.filter((m) => m.type === 'embed')
  }
}

const unit = (dim, hot = 0) => Float32Array.from({ length: dim }, (_, i) => (i === hot ? 1 : 0))
const latest = () => FakeWorker.all[FakeWorker.all.length - 1]

beforeEach(() => {
  FakeWorker.all = []
  vi.stubGlobal('Worker', FakeWorker) // "this browser can run workers"
  configureReaderForTests({ createWorker: () => new FakeWorker() })
})
afterEach(() => {
  vi.unstubAllGlobals()
  configureReaderForTests()
})

describe('starting the reader', () => {
  it('goes from idle to loading to ready, with download progress on the way', async () => {
    expect(getReaderState().status).toBe('idle')
    const seen = []
    const stop = subscribeReader(() => seen.push(getReaderState().status))

    const started = startReader()
    expect(getReaderState().status).toBe('loading')
    const w = latest()
    expect(w.sent[0]).toMatchObject({ type: 'load', model: HEAD.model })
    expect(w.sent[0].base).toMatch(/^https?:\/\//)

    w.say({ type: 'progress', loaded: 5, total: 10 })
    expect(getReaderState()).toMatchObject({ status: 'loading', loaded: 5, total: 10 })

    w.say({ type: 'ready' })
    expect(await started).toBe(true)
    expect(getReaderState().status).toBe('ready')
    expect(seen).toContain('ready')
    stop()
  })

  it('starts one worker however many times it is asked', async () => {
    const a = startReader()
    const b = startReader()
    expect(a).toBe(b)
    expect(FakeWorker.all).toHaveLength(1)
    latest().say({ type: 'ready' })
    await a
    expect(await startReader()).toBe(true)
    expect(FakeWorker.all).toHaveLength(1)
  })

  it('reports an error if loading fails, and a retry starts fresh', async () => {
    const first = startReader()
    latest().say({ type: 'failed', message: 'network down' })
    expect(await first).toBe(false)
    expect(getReaderState()).toMatchObject({ status: 'error', error: 'network down' })
    expect(FakeWorker.all[0].terminated).toBe(true)

    const second = startReader()
    expect(FakeWorker.all).toHaveLength(2)
    expect(getReaderState().status).toBe('loading')
    latest().say({ type: 'ready' })
    expect(await second).toBe(true)
  })

  it('can be retried after the worker could not even be created', async () => {
    let attempts = 0
    configureReaderForTests({
      createWorker: () => {
        attempts++
        if (attempts === 1) throw new Error('no workers here')
        return new FakeWorker()
      },
    })
    expect(await startReader()).toBe(false)
    expect(getReaderState()).toMatchObject({ status: 'error', error: 'no workers here' })

    const second = startReader()
    expect(getReaderState().status).toBe('loading')
    latest().say({ type: 'ready' })
    expect(await second).toBe(true)
  })

  it('reports an error if the worker itself crashes', async () => {
    const started = startReader()
    latest().onerror({ message: 'boom' })
    expect(await started).toBe(false)
    expect(getReaderState()).toMatchObject({ status: 'error', error: 'boom' })
  })

  describe('when loading hangs', () => {
    beforeEach(() => vi.useFakeTimers())
    afterEach(() => vi.useRealTimers())

    it('gives up after a long silence, so the card can offer a retry', async () => {
      const started = startReader()
      vi.advanceTimersByTime(STALL_MS - 1000)
      expect(getReaderState().status).toBe('loading')
      vi.advanceTimersByTime(2000)
      expect(await started).toBe(false)
      expect(getReaderState()).toMatchObject({ status: 'error' })
      expect(getReaderState().error).toMatch(/too long/)
      expect(FakeWorker.all[0].terminated).toBe(true)
    })

    it('counts every sign of life: progress keeps it waiting', async () => {
      const started = startReader()
      vi.advanceTimersByTime(STALL_MS - 1000)
      latest().say({ type: 'progress', loaded: 1, total: 10 })
      vi.advanceTimersByTime(STALL_MS - 1000)
      expect(getReaderState().status).toBe('loading')
      latest().say({ type: 'ready' })
      expect(await started).toBe(true)
      vi.advanceTimersByTime(STALL_MS * 2)
      expect(getReaderState().status).toBe('ready') // no longer watched once it is up
    })
  })

  it('says unsupported (and starts nothing) when the browser cannot run it', async () => {
    vi.unstubAllGlobals() // no Worker in plain Node
    expect(await startReader()).toBe(false)
    expect(getReaderState().status).toBe('unsupported')
    expect(FakeWorker.all).toHaveLength(0)
  })
})

describe('reading a note', () => {
  async function ready() {
    const started = startReader()
    latest().say({ type: 'ready' })
    await started
    return latest()
  }

  it('gives nothing until the reader is ready, and nothing for an empty note', async () => {
    expect(await classify('hello there')).toBeNull()
    await ready()
    expect(await classify('   ')).toBeNull()
    expect(await classify(undefined)).toBeNull()
    expect(latest().embeds()).toHaveLength(0)
  })

  it('turns the model’s numbers into a probability for each feeling', async () => {
    const w = await ready()
    const pending = classify('  A lovely day  ')
    const [request] = w.embeds()
    expect(request.text).toBe('A lovely day') // trimmed
    w.say({ type: 'vector', id: request.id, vector: unit(HEAD.dim, 7) })
    const result = await pending
    expect(result.vector).toHaveLength(HEAD.dim)
    expect(result.probs).toHaveLength(HEAD.feelings.length)
    expect(result.probs.reduce((a, b) => a + b, 0)).toBeCloseTo(1, 8)
  })

  it('answers the same note again without asking the model', async () => {
    const w = await ready()
    const first = classify('Same note')
    w.say({ type: 'vector', id: w.embeds()[0].id, vector: unit(HEAD.dim, 1) })
    const a = await first
    const b = await classify('Same note')
    expect(b).toBe(a)
    expect(w.embeds()).toHaveLength(1)
  })

  it('keeps answers matched to their notes when several are in flight', async () => {
    const w = await ready()
    const one = classify('first note')
    const two = classify('second note')
    const [r1, r2] = w.embeds()
    w.say({ type: 'vector', id: r2.id, vector: unit(HEAD.dim, 2) })
    w.say({ type: 'vector', id: r1.id, vector: unit(HEAD.dim, 1) })
    expect((await one).vector[1]).toBe(1)
    expect((await two).vector[2]).toBe(1)
  })

  it('fails only that note if the model errors on it, and stays ready', async () => {
    const w = await ready()
    const pending = classify('a note that breaks it')
    w.say({ type: 'failed', id: w.embeds()[0].id, message: 'bad input' })
    await expect(pending).rejects.toThrow('bad input')
    expect(getReaderState().status).toBe('ready')
  })

  it('rejects notes still waiting if the reader dies', async () => {
    const w = await ready()
    const pending = classify('waiting')
    w.onerror({ message: 'gone' })
    await expect(pending).rejects.toThrow('gone')
    expect(getReaderState().status).toBe('error')
  })
})

describe('stopping the reader', () => {
  it('frees the worker, goes back to idle, and can be started again', async () => {
    const started = startReader()
    latest().say({ type: 'ready' })
    await started
    const pending = classify('in flight')
    stopReader()
    expect(FakeWorker.all[0].terminated).toBe(true)
    expect(getReaderState().status).toBe('idle')
    await expect(pending).rejects.toThrow('turned off')
    expect(await classify('anything')).toBeNull()

    const again = startReader()
    expect(FakeWorker.all).toHaveLength(2)
    latest().say({ type: 'ready' })
    expect(await again).toBe(true)
  })
})
