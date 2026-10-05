import { useMemo, useState } from 'react'
import Screen from '../app/Screen'
import Stamp from '../components/stamp/Stamp'
import colorNames from '../data/colornames.json'
import moods from '../data/moods.json'
import palettes from '../data/palettes.json'
import { namePalette } from '../engine/colorNames'
import { chroma, hexToOklab, hue } from '../lib/color'
import './palettes.css'

const FAMILIES = Object.keys(moods.families)
const VIEWS = ['Palettes', 'Names', 'Moods']

/** Content review page: see every palette as a stamp, every color name, every mood's keywords. */
export default function Palettes() {
  const [view, setView] = useState('Palettes')

  return (
    <Screen caption="Content review" title="Palettes & words">
      <div className="seg" role="tablist" aria-label="View">
        {VIEWS.map((v) => (
          <button
            key={v}
            role="tab"
            aria-selected={view === v}
            className={view === v ? 'on' : ''}
            onClick={() => setView(v)}
          >
            {v}
          </button>
        ))}
      </div>
      {view === 'Palettes' && <PaletteView />}
      {view === 'Names' && <NamesView />}
      {view === 'Moods' && <MoodsView />}
    </Screen>
  )
}

function PaletteView() {
  const [family, setFamily] = useState('all')
  const shown = family === 'all' ? FAMILIES : [family]
  const total = Object.values(palettes).flat().length

  return (
    <>
      <div className="chips" role="group" aria-label="Mood family">
        <button className={family === 'all' ? 'on' : ''} onClick={() => setFamily('all')}>
          All · {total}
        </button>
        {FAMILIES.map((f) => (
          <button key={f} className={family === f ? 'on' : ''} onClick={() => setFamily(f)}>
            {moods.families[f].label} · {palettes[f].length}
          </button>
        ))}
      </div>

      {shown.map((f) => (
        <section key={f} className="family">
          <h2>{moods.families[f].label}</h2>
          {palettes[f].map((p) => (
            <PaletteCard key={p.id} palette={p} />
          ))}
        </section>
      ))}
    </>
  )
}

function PaletteCard({ palette }) {
  const named = useMemo(() => namePalette(palette.colors), [palette.colors])
  return (
    <article className="pcard">
      <div className="pcard__stamp">
        <Stamp
          colors={palette.colors}
          seed={palette.id}
          width={104}
          label={`${palette.name}: ${named.map((n) => n.name).join(', ')}`}
        />
      </div>
      <div className="pcard__body">
        <h3>{palette.name}</h3>
        <div className="pcard__harmony">{palette.harmony}</div>
        <ul>
          {named.map((n) => (
            <li key={n.hex}>
              <i style={{ background: n.hex }} />
              <span className="pcard__name">{n.name}</span>
              <code>{n.hex}</code>
            </li>
          ))}
        </ul>
      </div>
    </article>
  )
}

// Neutrals first (dark to light), then by hue, then dark to light.
function sortNames(list) {
  const rows = list.map((c) => {
    const lab = hexToOklab(c.hex)
    return { ...c, L: lab.L, neutral: chroma(lab) < 0.03, h: hue(lab) }
  })
  return rows.sort((a, b) =>
    a.neutral !== b.neutral
      ? a.neutral
        ? -1
        : 1
      : a.neutral
        ? a.L - b.L
        : Math.floor(a.h / 20) - Math.floor(b.h / 20) || a.L - b.L,
  )
}

function NamesView() {
  const rows = useMemo(() => sortNames(colorNames), [])
  return (
    <>
      <p className="screen__note">
        {rows.length} names, neutrals first, then around the color wheel. Each swatch is the color
        the name describes.
      </p>
      <div className="names">
        {rows.map((c) => (
          <div key={c.name} className="names__tile">
            <i style={{ background: c.hex }} />
            <span>{c.name}</span>
            <code>{c.hex}</code>
          </div>
        ))}
      </div>
    </>
  )
}

function MoodsView() {
  const { activeProfile, profiles } = moods.fallback
  return (
    <>
      <p className="screen__note">
        When a note matches none of these words, the app falls back to the time of day, then the
        month (profile: <b>{activeProfile}</b>).
      </p>
      {FAMILIES.map((f) => {
        const { label, keywords, hours } = moods.families[f]
        return (
          <section key={f} className="family">
            <h2>
              {label} <small>{keywords.length} words</small>
            </h2>
            {hours.length > 0 && (
              <div className="pcard__harmony">wins ties at hours {hours.join(', ')}</div>
            )}
            <div className="kw">
              {keywords.map((k) => (
                <span key={k}>{k}</span>
              ))}
            </div>
          </section>
        )
      })}
      <section className="family">
        <h2>Fallback by month</h2>
        {Object.entries(profiles).map(([name, p]) => (
          <div key={name} className="fb">
            <b>{name}</b>
            <span>
              {Object.entries(p.monthFamily)
                .map(([m, f]) => `${m}: ${moods.families[f].label}`)
                .join(' · ')}
            </span>
          </div>
        ))}
      </section>
    </>
  )
}
