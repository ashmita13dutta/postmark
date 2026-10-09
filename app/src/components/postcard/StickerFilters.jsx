import { TONES } from '../../data/stickers'

/** '#B59B76' -> 0.71 (red), for an SVG color table. */
const channel = (hex, i) => (parseInt(hex.slice(1 + i * 2, 3 + i * 2), 16) / 255).toFixed(3)

/**
 * The shared SVG filters sticker looks are built from (hidden; CSS points at them by id):
 *   sticker-gloss     a soft highlight on the drawn doodles
 *   sticker-outline   the white die-cut edge around a sticker
 *   tone-<id>         a wash of one color ramp over a picture sticker, keeping its shading
 * Render this once on any screen that shows stickers.
 */
export default function StickerFilters() {
  return (
    <svg width="0" height="0" aria-hidden="true" style={{ position: 'absolute' }}>
      <filter id="sticker-gloss" x="-10%" y="-10%" width="120%" height="120%">
        <feGaussianBlur in="SourceAlpha" stdDeviation="2" result="blur" />
        <feSpecularLighting
          in="blur"
          surfaceScale="3"
          specularConstant="0.6"
          specularExponent="20"
          lightingColor="#fff"
          result="spec"
        >
          <fePointLight x="-40" y="-60" z="120" />
        </feSpecularLighting>
        <feComposite in="spec" in2="SourceAlpha" operator="in" result="sheen" />
        <feComposite
          in="SourceGraphic"
          in2="sheen"
          operator="arithmetic"
          k1="0"
          k2="1"
          k3="0.5"
          k4="0"
        />
      </filter>

      {/* grow the shape a few pixels, harden the soft edge, paint it white, put the sticker on top */}
      <filter
        id="sticker-outline"
        x="-25%"
        y="-25%"
        width="150%"
        height="150%"
        colorInterpolationFilters="sRGB"
      >
        <feMorphology in="SourceAlpha" operator="dilate" radius="2.5" result="grown" />
        <feGaussianBlur in="grown" stdDeviation="0.7" result="soft" />
        <feComponentTransfer in="soft" result="edge">
          <feFuncA type="linear" slope="4" intercept="-0.5" />
        </feComponentTransfer>
        <feFlood floodColor="#fff" result="white" />
        <feComposite in="white" in2="edge" operator="in" result="rim" />
        <feMerge>
          <feMergeNode in="rim" />
          <feMergeNode in="SourceGraphic" />
        </feMerge>
      </filter>

      {TONES.filter((tone) => tone.ramp).map((tone) => (
        <filter key={tone.id} id={`tone-${tone.id}`} colorInterpolationFilters="sRGB">
          {/* to grey first, then map grey (dark to light) onto the tone's ramp */}
          <feColorMatrix
            type="matrix"
            values="0.299 0.587 0.114 0 0  0.299 0.587 0.114 0 0  0.299 0.587 0.114 0 0  0 0 0 1 0"
          />
          {/* pull the light greys down a little first, so highlights and shading stay apart */}
          <feComponentTransfer>
            <feFuncR type="gamma" amplitude="1" exponent="1.7" offset="0" />
            <feFuncG type="gamma" amplitude="1" exponent="1.7" offset="0" />
            <feFuncB type="gamma" amplitude="1" exponent="1.7" offset="0" />
          </feComponentTransfer>
          <feComponentTransfer>
            <feFuncR type="table" tableValues={tone.ramp.map((c) => channel(c, 0)).join(' ')} />
            <feFuncG type="table" tableValues={tone.ramp.map((c) => channel(c, 1)).join(' ')} />
            <feFuncB type="table" tableValues={tone.ramp.map((c) => channel(c, 2)).join(' ')} />
          </feComponentTransfer>
        </filter>
      ))}
    </svg>
  )
}
