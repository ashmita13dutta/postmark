import { useId } from 'react'
import { IMAGE_BOX, findSticker } from '../../data/stickers'
import { doodleLayout, doodleMarkup, findDoodle } from '../../data/doodles'
import { findTape, tapeLayout, tapeMarkup } from '../../data/tapes'
import { findWord, wordLayout } from '../../data/words'

const RED = '#B14126'
const PURPLE = '#534AB7'

// Size of each sticker in px at scale 1. The decoration's `scale` multiplies this.
const SIZES = {
  stamp: { width: 132, height: 52 },
  handle: { width: 132, height: 60 },
  doodle: { width: 60, height: 60 },
}

const STAMP_TEXT = {
  fragile: { lines: ['FRAGILE'], color: RED },
  urgent: { lines: ['URGENT'], color: RED },
  handle: { lines: ['HANDLE', 'WITH CARE'], color: PURPLE },
  return: { lines: ['RETURN TO', 'SENDER'], color: PURPLE },
}

/** A picture sticker, scaled to fit the standard box while keeping its shape. */
function imageSize(id) {
  const sticker = findSticker(id)
  if (!sticker?.w || !sticker?.h) return SIZES.doodle
  const k = IMAGE_BOX / Math.max(sticker.w, sticker.h)
  return { width: Math.round(sticker.w * k), height: Math.round(sticker.h * k) }
}

export function stickerSize(id) {
  const [kind, name] = id.split(':')
  if (kind === 'img') return imageSize(id)
  if (kind === 'tape') {
    const tape = findTape(name)
    return tape ? tapeLayout(tape) : SIZES.doodle
  }
  if (kind === 'doodle') {
    const doodle = findDoodle(name)
    return doodle ? doodleLayout(doodle) : SIZES.doodle
  }
  if (kind === 'word') {
    const word = findWord(name)
    if (!word) return SIZES.doodle
    const { width, height } = wordLayout(word)
    return { width, height }
  }
  if (kind === 'stamp') return STAMP_TEXT[name]?.lines.length > 1 ? SIZES.handle : SIZES.stamp
  return SIZES[kind] ?? SIZES.doodle
}

function RubberStamp({ name }) {
  const { lines, color } = STAMP_TEXT[name]
  const { width, height } = stickerSize(`stamp:${name}`)
  const size = lines.length > 1 ? 14 : 19
  // each stamp carries its own ink filter, so it works wherever the stamp is drawn (card or tray)
  const grain = `ink-${useId().replace(/[^a-zA-Z0-9_-]/g, '')}`
  return (
    <svg viewBox={`0 0 ${width} ${height}`} width={width} height={height} fill="none">
      <defs>
        {/* worn rubber: noise becomes see-through flecks, so the ink thins out and drops here and there */}
        <filter
          id={grain}
          x="-5%"
          y="-5%"
          width="110%"
          height="110%"
          colorInterpolationFilters="sRGB"
        >
          <feTurbulence
            type="fractalNoise"
            baseFrequency="0.85"
            numOctaves="2"
            seed={lines.join('').length}
            result="noise"
          />
          <feColorMatrix
            in="noise"
            type="matrix"
            values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  12 0 0 0 -3.1"
            result="flecks"
          />
          <feComposite in="SourceGraphic" in2="flecks" operator="in" />
        </filter>
      </defs>
      <g filter={`url(#${grain})`}>
        <g stroke={color} opacity=".82">
          <rect x="2" y="2" width={width - 4} height={height - 4} rx="4" strokeWidth="2.4" />
          <rect x="6" y="6" width={width - 12} height={height - 12} rx="2" strokeWidth="1" />
        </g>
        <g
          fill={color}
          opacity=".85"
          fontFamily="var(--font-mono)"
          fontWeight="700"
          textAnchor="middle"
        >
          {lines.map((line, i) => (
            <text
              key={line}
              x={width / 2}
              y={height / 2 + (lines.length > 1 ? (i === 0 ? -3 : 13) : 7)}
              fontSize={size}
              letterSpacing="1.5"
            >
              {line}
            </text>
          ))}
        </g>
      </g>
    </svg>
  )
}

/**
 * A washi tape (tapes.json). The drawing is built as SVG text by data/tapes.js; the ids inside it
 * must be unique, because the same tape can be on the card and in the tray at the same time.
 */
function TapeSticker({ tape, palette }) {
  const { width, height } = tapeLayout(tape)
  const uid = `tp${useId().replace(/[^a-zA-Z0-9_-]/g, '')}`
  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      width={width}
      height={height}
      dangerouslySetInnerHTML={{ __html: tapeMarkup(tape, palette, uid) }}
    />
  )
}

/** A doodle (doodles.json): a small hand-inked drawing, optionally in the day's colors. */
function DoodleSticker({ doodle, palette }) {
  const { width, height } = doodleLayout(doodle)
  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      width={width}
      height={height}
      dangerouslySetInnerHTML={{ __html: doodleMarkup(doodle, palette) }}
    />
  )
}

/**
 * A caption (words.json). The browser stretches the letters to exactly `textWidth` (textLength), so
 * the box never has to be measured: a script word is colored handwriting, a label is a rounded tag
 * with cream capitals.
 */
function WordSticker({ word }) {
  const { text, look, color, fontSize, family, baseline, padX, textWidth, width, height } =
    wordLayout(word)
  const label = look === 'label'
  return (
    <svg viewBox={`0 0 ${width} ${height}`} width={width} height={height}>
      {label && <rect width={width} height={height} rx={height / 2} fill={color} />}
      <text
        x={padX}
        y={baseline}
        fontSize={fontSize}
        fontWeight={label ? 700 : 400}
        letterSpacing={label ? 1.2 : 0}
        fill={label ? '#FDF8EC' : color}
        textLength={textWidth}
        lengthAdjust="spacingAndGlyphs"
        style={{ fontFamily: `var(${family})` }}
      >
        {text}
      </text>
    </svg>
  )
}

/** Stands in for a picture sticker whose pack has since been removed, so it can still be removed. */
function MissingSticker() {
  return (
    <svg viewBox="0 0 60 60" width={SIZES.doodle.width} height={SIZES.doodle.height}>
      <rect
        x="4"
        y="4"
        width="52"
        height="52"
        rx="8"
        fill="none"
        stroke="#2A2620"
        strokeOpacity=".4"
        strokeWidth="2"
        strokeDasharray="5 4"
      />
      <text x="30" y="39" textAnchor="middle" fontSize="26" fill="#2A2620" fillOpacity=".4">
        ?
      </text>
    </svg>
  )
}

/**
 * One sticker, drawn at its natural size. `palette` is the day's five swatches ({hex}), used by
 * tapes and doodles that follow the day's colors. Unknown drawn ids draw nothing, so an old postcard never breaks the screen.
 */
export default function Sticker({ id, palette = [] }) {
  const [kind, name] = id.split(':')
  if (kind === 'img') {
    const sticker = findSticker(id)
    if (!sticker) return <MissingSticker />
    const { width, height } = imageSize(id)
    return (
      <img
        className="sticker-img"
        src={`${import.meta.env.BASE_URL}${sticker.src}`}
        width={width}
        height={height}
        alt=""
        draggable={false}
        decoding="async"
      />
    )
  }
  if (kind === 'word') {
    const word = findWord(name)
    // a word you took out of words.json still shows as a dashed "?" so it can be removed
    return word ? <WordSticker word={word} /> : <MissingSticker />
  }
  if (kind === 'stamp' && STAMP_TEXT[name]) return <RubberStamp name={name} />
  if (kind === 'tape') {
    const tape = findTape(name)
    // a tape taken out of tapes.json still shows as a dashed "?" so it can be removed
    return tape ? <TapeSticker tape={tape} palette={palette} /> : <MissingSticker />
  }
  if (kind === 'doodle') {
    const doodle = findDoodle(name)
    return doodle ? <DoodleSticker doodle={doodle} palette={palette} /> : <MissingSticker />
  }
  return null
}
