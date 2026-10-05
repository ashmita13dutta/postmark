// "Does the stamp look right for the feeling?" Each feeling has a look envelope in feelings.json:
// the average color strength (chroma) and average lightness of its five colors. A sad stamp must
// never come out candy-bright, and a joyful one must never come out grey.
import { describe, expect, it } from 'vitest'
import { feelings } from '../src/data/feelings.json'
import palettes from '../src/data/palettes.json'
import { topics } from '../src/data/topics.json'
import { buildPalette } from '../src/engine/palette'
import { chroma, hexToOklab } from '../src/lib/color'

const look = (hexes) => {
  const labs = hexes.map(hexToOklab)
  return {
    chroma: labs.reduce((s, l) => s + chroma(l), 0) / labs.length,
    lightness: labs.reduce((s, l) => s + l.L, 0) / labs.length,
  }
}
const within = (v, [lo, hi]) => v >= lo && v <= hi
const ids = Object.keys(feelings)

describe('look envelopes in feelings.json', () => {
  it.each(ids)('%s has a valid envelope', (id) => {
    const { chroma: c, lightness: l } = feelings[id].look
    for (const [lo, hi] of [c, l]) {
      expect(lo).toBeLessThan(hi)
      expect(lo).toBeGreaterThanOrEqual(0)
    }
    expect(c[1]).toBeLessThanOrEqual(0.2) // nothing neon, even at the top of the range
    expect(l[1]).toBeLessThanOrEqual(1)
  })

  it('bright feelings are more colorful than muted ones', () => {
    const lowEnd = (id) => feelings[id].look.chroma[0]
    const highEnd = (id) => feelings[id].look.chroma[1]
    for (const bright of ['joyful', 'excited', 'proud']) {
      for (const muted of ['tired', 'sad', 'bored', 'disappointed']) {
        expect(lowEnd(bright), `${bright} vs ${muted}`).toBeGreaterThan(lowEnd(muted))
        expect(highEnd(bright), `${bright} vs ${muted}`).toBeGreaterThan(highEnd(muted))
      }
    }
  })
})

describe('every palette fits its feeling', () => {
  it('average color strength and lightness are inside the envelope', () => {
    const bad = []
    for (const id of ids) {
      for (const p of palettes[id]) {
        const l = look(p.colors)
        if (!within(l.chroma, feelings[id].look.chroma)) {
          bad.push(
            `${id}/${p.id}: color strength ${l.chroma.toFixed(3)} outside ${feelings[id].look.chroma}`,
          )
        }
        if (!within(l.lightness, feelings[id].look.lightness)) {
          bad.push(
            `${id}/${p.id}: lightness ${l.lightness.toFixed(2)} outside ${feelings[id].look.lightness}`,
          )
        }
      }
    }
    expect(bad).toEqual([])
  })
})

describe('every stamp the engine can build fits its feeling', () => {
  it('across topics, hours, seasons and energies', () => {
    const bad = []
    for (const id of ids) {
      for (const topic of Object.keys(topics)) {
        for (const hour of [2, 15]) {
          for (const month of [1, 7]) {
            for (const energy of ['soft', 'vivid']) {
              const seed = `${topic}-${hour}-${month}-${energy}`
              const b = buildPalette({ feeling: id, topic, energy, seed, hour, month })
              const l = look(b.colors.map((c) => c.hex))
              const why = []
              if (!within(l.chroma, feelings[id].look.chroma))
                why.push(`strength ${l.chroma.toFixed(3)}`)
              if (!within(l.lightness, feelings[id].look.lightness))
                why.push(`lightness ${l.lightness.toFixed(2)}`)
              if (why.length)
                bad.push(
                  `${id} + ${topic} h${hour} m${month} ${energy}: ${why.join(', ')} (${b.palette.id})`,
                )
            }
          }
        }
      }
    }
    expect(bad.slice(0, 30), `${bad.length} stamps out of range`).toEqual([])
  }, 60_000)
})

describe('on average, the mood shows in the color', () => {
  it('joyful, excited and proud stamps are clearly more colorful than tired, sad, bored and disappointed ones', () => {
    const avg = (id) => {
      let sum = 0
      let n = 0
      for (const topic of Object.keys(topics)) {
        for (const hour of [2, 15]) {
          for (const month of [1, 7]) {
            const b = buildPalette({
              feeling: id,
              topic,
              seed: `${topic}${hour}${month}`,
              hour,
              month,
            })
            sum += look(b.colors.map((c) => c.hex)).chroma
            n++
          }
        }
      }
      return sum / n
    }
    const bright = ['joyful', 'excited', 'proud'].map(avg)
    const muted = ['tired', 'sad', 'bored', 'disappointed'].map(avg)
    expect(Math.min(...bright) - Math.max(...muted)).toBeGreaterThan(0.015)
  }, 60_000)
})
