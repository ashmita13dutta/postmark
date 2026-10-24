import { useMemo, useState } from 'react'
import { PACKS } from '../../data/stickers'
import { COVER_SLOTS } from '../../lib/volumes'
import VolumeCover from './VolumeCover'

/**
 * Decorate a volume's cover: six slots, each takes one sticker from the packs the year's delivered
 * months were given (plus one that is always there). Tap a slot, tap a sticker; the cover updates as
 * you go. `onSave(list)` gets [{ slot, stickerId }].
 */
export default function CoverEditor({
  year,
  number,
  moments,
  closed,
  stickers,
  packIds,
  onSave,
  onClose,
}) {
  const [chosen, setChosen] = useState(stickers)
  const [slot, setSlot] = useState(() => {
    const free = Array.from({ length: COVER_SLOTS }, (_, i) => i).find(
      (i) => !stickers.some((s) => s.slot === i),
    )
    return free ?? 0
  })
  const pool = useMemo(
    () =>
      packIds.flatMap((id) => {
        const pack = PACKS.find((p) => p.id === id)
        return pack ? [{ pack, items: pack.items.filter((s) => s.src && !s.ink) }] : []
      }),
    [packIds],
  )
  const at = (i) => chosen.find((s) => s.slot === i)

  function place(stickerId) {
    setChosen((list) => [...list.filter((s) => s.slot !== slot), { slot, stickerId }])
    setSlot((s) => (s + 1) % COVER_SLOTS)
  }
  const clear = () => setChosen((list) => list.filter((s) => s.slot !== slot))

  return (
    <div className="cover__scrim" onClick={onClose}>
      <div
        className="cover__sheet"
        role="dialog"
        aria-label={`Decorate the cover of ${year}`}
        onClick={(e) => e.stopPropagation()}
      >
        <VolumeCover
          year={year}
          number={number}
          moments={moments}
          stickers={chosen}
          closed={closed}
          width={150}
        />
        <div className="cover__slots" role="group" aria-label="Slots">
          {Array.from({ length: COVER_SLOTS }, (_, i) => (
            <button
              key={i}
              className={`cover__slot${i === slot ? ' on' : ''}`}
              aria-pressed={i === slot}
              aria-label={`Slot ${i + 1}${at(i) ? ', filled' : ', empty'}`}
              onClick={() => setSlot(i)}
            >
              {i + 1}
            </button>
          ))}
          <button className="cover__clear" disabled={!at(slot)} onClick={clear}>
            Clear slot
          </button>
        </div>
        <div className="cover__tray">
          {pool.map(({ pack, items }) => (
            <section key={pack.id}>
              <h3 className="cover__pack">{pack.label}</h3>
              <ul>
                {items.map((s) => (
                  <li key={s.id}>
                    <button
                      aria-label={`Put ${s.label} in slot ${slot + 1}`}
                      onClick={() => place(s.id)}
                    >
                      <img src={`${import.meta.env.BASE_URL}${s.src}`} alt="" draggable={false} />
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
        <div className="cover__actions">
          <button className="cover__done" onClick={() => onSave(chosen)}>
            Save the cover
          </button>
          <button onClick={onClose}>Cancel</button>
        </div>
      </div>
    </div>
  )
}
