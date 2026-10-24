import { queries } from '../db/queries'
import { seededRng } from './rng'
import { finishPhoto } from './photo'

const SIZE = 480

/** A made-up "photo" in a postcard's own colors: soft light, a horizon and a few round shapes. */
function samplePicture(colors, seed) {
  const rnd = seededRng(`demo-photo:${seed}`)
  const canvas = document.createElement('canvas')
  canvas.width = SIZE
  canvas.height = Math.round(SIZE * 0.75)
  const ctx = canvas.getContext('2d')
  const sky = ctx.createLinearGradient(0, 0, 0, canvas.height)
  sky.addColorStop(0, colors[0])
  sky.addColorStop(1, colors[1])
  ctx.fillStyle = sky
  ctx.fillRect(0, 0, canvas.width, canvas.height)
  const horizon = canvas.height * (0.55 + rnd() * 0.15)
  ctx.fillStyle = colors[2]
  ctx.fillRect(0, horizon, canvas.width, canvas.height - horizon)
  for (let i = 0; i < 5; i++) {
    ctx.globalAlpha = 0.5 + rnd() * 0.4
    ctx.fillStyle = colors[(i % 3) + 2]
    ctx.beginPath()
    ctx.arc(rnd() * canvas.width, rnd() * canvas.height, 24 + rnd() * 70, 0, Math.PI * 2)
    ctx.fill()
  }
  ctx.globalAlpha = 1
  return canvas
}

/**
 * Give demo postcards photos so the peek can be tried without taking any: about half become a
 * photo-booth film strip. A postcard that already has a photo is left alone. Returns how many got one.
 */
export async function addSamplePhotos() {
  const moments = (await queries.allMoments()).filter((m) => m.demo === true).slice(-12)
  let added = 0
  for (const m of moments) {
    if ((await queries.mediaForMoment(m.id)).length) continue
    const colors = m.palette.map((c) => c.hex)
    const rnd = seededRng(`demo-kind:${m.day}`)
    const kind = rnd() < 0.5 ? 'strip' : 'single'
    const pictures = Array.from({ length: kind === 'strip' ? 3 : 1 }, (_, i) =>
      samplePicture(colors.slice(i).concat(colors.slice(0, i)), `${m.day}:${i}`),
    )
    const settings = { kind, filter: 'vintage', intensity: 0.7, seed: m.day }
    const { blob, thumb, sources } = await finishPhoto(pictures, settings)
    await queries.setMedia(m.id, {
      kind,
      blob,
      thumb,
      sources,
      filter: 'vintage',
      intensity: 0.7,
      layoutSeed: m.day,
    })
    added += 1
  }
  return { added }
}
