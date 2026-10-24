import { WAX_COLORS, findSticker } from '../../data/stickers'
import { roman } from '../../lib/album'
import { coverColors, coverSlots } from '../../lib/volumes'
import WaxSeal from '../postcard/WaxSeal'

/** The wax a volume is sealed with: the same colour every time for a year. */
export const sealColorFor = (year) => WAX_COLORS[year % WAX_COLORS.length].hex

/**
 * A volume's cover: a band of the year's five colors down the spine, a label with "Volume I" and the
 * year, up to six picture stickers in their slots, and (once the year is closed) the final wax seal.
 *  - year, number: which volume
 *  - moments:      that year's stamps, for the colors
 *  - stickers:     [{ slot, stickerId }] as stored
 *  - closed:       shows the seal
 *  - width:        px
 */
export default function VolumeCover({ year, number, moments, stickers = [], closed, width = 200 }) {
  const colors = coverColors(moments)
  const slots = coverSlots(year)
  const size = Math.round(width * 0.27)
  return (
    <div
      className="cover__book"
      style={{ width, '--cover-w': `${width}px` }}
      role="img"
      aria-label={`Volume ${roman(number)}, ${year}${closed ? ', closed' : ''}`}
    >
      <i
        className="cover__spine"
        aria-hidden="true"
        style={{
          background: `linear-gradient(to bottom, ${colors
            .map((c, i) => `${c} ${i * 20}% ${(i + 1) * 20}%`)
            .join(', ')})`,
        }}
      />
      <div className="cover__label">
        <small>Volume</small>
        <strong>{roman(number)}</strong>
        <span>{year}</span>
      </div>
      {stickers.map(({ slot, stickerId }) => {
        const sticker = findSticker(stickerId)
        const at = slots[slot]
        if (!sticker || !at) return null
        return (
          <img
            key={slot}
            className="cover__sticker"
            src={`${import.meta.env.BASE_URL}${sticker.src}`}
            alt=""
            draggable={false}
            style={{
              width: size,
              height: size,
              left: `${at.x * 100}%`,
              top: `${at.y * 100}%`,
              transform: `translate(-50%, -50%) rotate(${at.rotate}deg)`,
            }}
          />
        )
      })}
      {closed && (
        <span className="cover__seal">
          <WaxSeal
            color={sealColorFor(year)}
            seed={`volume:${year}`}
            size={Math.round(width * 0.3)}
          />
        </span>
      )}
    </div>
  )
}
