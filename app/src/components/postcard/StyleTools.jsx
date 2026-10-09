import { TONES, canOutline, canTone } from '../../data/stickers'

/** What a tone dot looks like: the sticker's own colors, or a swatch of the tone's ramp. */
const dot = (tone) =>
  tone.ramp
    ? `linear-gradient(135deg, ${tone.ramp[3]}, ${tone.ramp[1]} 55%, ${tone.ramp[0]})`
    : 'conic-gradient(#e7c64b, #e39544, #b14126, #534ab7, #3a5771, #3f6b4a, #e7c64b)'

/**
 * The look of the selected sticker: a white die-cut edge on or off, and (for picture stickers) a
 * tone to wash it in. `onChange` gets { outline } or { tone }.
 */
export default function StyleTools({ deco, onChange }) {
  const outline = deco.outline ?? true
  const tone = deco.tone ?? 'original'
  const withOutline = canOutline(deco.stickerId)
  const withTone = canTone(deco.stickerId)
  if (!withOutline && !withTone) return null
  return (
    <div className="pc__style" role="group" aria-label="Sticker look">
      {withOutline && (
        <button
          className={outline ? 'pc__chip on' : 'pc__chip'}
          aria-pressed={outline}
          onClick={() => onChange({ outline: !outline })}
        >
          White edge
        </button>
      )}
      {withTone && (
        <div className="pc__tones" role="radiogroup" aria-label="Tone">
          {TONES.map((t) => (
            <button
              key={t.id}
              role="radio"
              aria-checked={tone === t.id}
              aria-label={t.label}
              title={t.label}
              className={tone === t.id ? 'pc__tone on' : 'pc__tone'}
              style={{ background: dot(t) }}
              onClick={() => onChange({ tone: t.id })}
            />
          ))}
        </div>
      )}
    </div>
  )
}
