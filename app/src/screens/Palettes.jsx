import { useMemo, useState } from 'react'
import Screen from '../app/Screen'
import Stamp from '../components/stamp/Stamp'
import colorNames from '../data/colornames.json'
import { feelings, defaultFeeling } from '../data/feelings.json'
import palettes from '../data/palettes.json'
import { topics, fallback } from '../data/topics.json'
import { namePalette } from '../engine/colorNames'
import { detectMood, contextAt } from '../engine/mood'
import { composePalette } from '../engine/palette'
import { now } from '../lib/clock'
import { chroma, hexToOklab, hue } from '../lib/color'
import { todayKey } from '../lib/dates'
import './palettes.css'

const FEELING_IDS = Object.keys(feelings)
const VIEWS = ['Note', 'Mix', 'Feelings', 'Themes', 'Topics', 'Names']
const SAMPLE_NOTES = [
  'Went shopping with Riya, bought the cutest dress, so happy!',
  'Exam tomorrow and I am so stressed. Cannot focus at all.',
  'Rain at Elgin crossing, taxi would not start. Jhalmuri in a shop doorway.',
  'First snow of the year! Hot chocolate and a blanket, watching movies all day.',
  'The pasta was soggy and cold. Total waste of money.',
  'Date with Arjun at the cafe, he brought me flowers 😍',
]

// every palette with the feeling it belongs to, and the themes (topics) it was made for
const ALL = Object.entries(palettes).flatMap(([feeling, list]) =>
  list.map((p) => ({ ...p, feeling })),
)
const THEME_COUNTS = ALL.reduce((acc, p) => {
  for (const t of p.topics ?? []) acc[t] = (acc[t] ?? 0) + 1
  return acc
}, {})
// seasons and big themes first, then the rest by how many palettes they have
const THEME_FIRST = ['autumn', 'winter', 'snow', 'party', 'dating', 'friends', 'food', 'travel']
const THEME_IDS = Object.keys(THEME_COUNTS).sort(
  (a, b) =>
    (THEME_FIRST.indexOf(a) + 1 || 99) - (THEME_FIRST.indexOf(b) + 1 || 99) ||
    THEME_COUNTS[b] - THEME_COUNTS[a],
)

// topics grouped for the picker and the Topics view, in file order
const GROUPS = Object.entries(topics).reduce((acc, [id, t]) => {
  ;(acc[t.group] ??= []).push(id)
  return acc
}, {})

/** Content review page: see palettes, topics and names the way the app will use them. */
export default function Palettes() {
  const [view, setView] = useState('Note')
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
      {view === 'Note' && <NoteView />}
      {view === 'Mix' && <MixView />}
      {view === 'Feelings' && <FeelingsView />}
      {view === 'Themes' && <ThemesView />}
      {view === 'Topics' && <TopicsView />}
      {view === 'Names' && <NamesView />}
    </Screen>
  )
}

function Swatches({ colors, label }) {
  const named = useMemo(() => namePalette(colors), [colors])
  return (
    <ul className="swatches" aria-label={label}>
      {named.map((n) => (
        <li key={n.hex}>
          <i style={{ background: n.hex }} />
          <span className="pcard__name">{n.name}</span>
          <code>{n.hex}</code>
        </li>
      ))}
    </ul>
  )
}

/** Type a note and see what the mood engine makes of it, and the stamp it would produce. */
function NoteView() {
  const [text, setText] = useState(SAMPLE_NOTES[0])
  // time of day and month come from the app clock, so ?now= time travel changes the fallbacks
  const ctx = contextAt(now())
  const day = todayKey()
  const mood = useMemo(
    () => detectMood({ text, hour: ctx.hour, month: ctx.month }),
    [text, ctx.hour, ctx.month],
  )
  const result = useMemo(
    () =>
      composePalette({ feeling: mood.feeling, topic: mood.topic, seed: day, energy: mood.energy }),
    [mood.feeling, mood.topic, mood.energy, day],
  )
  const how = (source, words) =>
    ({
      words: words.length ? `from “${words.join('”, “')}”` : 'from your words',
      topic: 'no feeling words, so the topic’s usual mood',
      default: 'nothing matched, so the default',
      time: 'nothing matched, so the time of day',
      season: 'nothing matched, so the season',
    })[source]

  return (
    <>
      <p className="screen__note">
        Write a note the way you would in the app. It finds how the day <b>felt</b> and what it was{' '}
        <b>about</b>, then builds the stamp. Nothing leaves your phone.
      </p>
      <textarea
        className="note"
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={4}
        placeholder="What happened today?"
        aria-label="Your note"
      />
      <div className="chips samples" role="group" aria-label="Try a sample note">
        {SAMPLE_NOTES.map((n) => (
          <button key={n} onClick={() => setText(n)}>
            {n.slice(0, 22)}…
          </button>
        ))}
      </div>

      <div className="mix">
        <div className="mix__col">
          <div className="lbl">Today’s stamp</div>
          <Stamp colors={result.colors} seed={day} width={120} label="Stamp for this note" />
          <span className="tag">
            {result.tagged ? 'made for this' : result.mixed ? 'accents added' : result.palette.name}
          </span>
        </div>
      </div>

      <div className="found">
        <div>
          <span className="lbl">Felt</span>
          <b>
            {feelings[mood.feeling].label}{' '}
            {mood.energy === 'vivid' && <span className="tag">vivid</span>}
          </b>
          <small>
            {how(mood.source.feeling, mood.feelingWords)} · {mood.confidence.feeling} confidence
          </small>
        </div>
        <div>
          <span className="lbl">About</span>
          <b>
            {topics[mood.topic].label}
            {mood.secondaryTopic && <i> + {topics[mood.secondaryTopic].label}</i>}
          </b>
          <small>
            {how(mood.source.topic, mood.topicWords)}
            {mood.source.topic === 'words' ? ` · ${mood.confidence.topic} confidence` : ''}
          </small>
        </div>
      </div>

      <Swatches colors={result.colors} label="Stamp colors" />
    </>
  )
}

/** Pick a feeling and a topic, see what a day like that would look like. */
function MixView() {
  const [feeling, setFeeling] = useState('joyful')
  const [topic, setTopic] = useState('shopping')
  const [shuffle, setShuffle] = useState(0)

  // the same recipe the app will use: a palette made for the topic if there is one, otherwise
  // a general palette for the feeling with the topic's accents mixed in
  const result = useMemo(
    () =>
      composePalette({
        feeling,
        topic: topic === 'none' ? null : topic,
        seed: `try-${shuffle}`,
      }),
    [feeling, topic, shuffle],
  )
  const base = result.palette
  const mixed = result
  const poolSize = palettes[feeling].length

  return (
    <>
      <p className="screen__note">
        Pick how the day <b>felt</b> and what it was <b>about</b>. The feeling chooses the palette
        (one made for the topic if there is one); otherwise the topic swaps in its own accent
        colors.
      </p>

      <div className="label">How it felt</div>
      <div className="chips" role="group" aria-label="Feeling">
        {FEELING_IDS.map((f) => (
          <button
            key={f}
            className={feeling === f ? 'on' : ''}
            onClick={() => {
              setFeeling(f)
              setShuffle(0)
            }}
          >
            {feelings[f].label}
          </button>
        ))}
      </div>

      <div className="label">What it was about</div>
      <select className="picker" value={topic} onChange={(e) => setTopic(e.target.value)}>
        <option value="none">Nothing in particular</option>
        {Object.entries(GROUPS).map(([group, ids]) => (
          <optgroup key={group} label={group}>
            {ids.map((id) => (
              <option key={id} value={id}>
                {topics[id].label}
              </option>
            ))}
          </optgroup>
        ))}
      </select>

      <div className="mix">
        <div className="mix__col">
          <div className="lbl">Palette: {base.name}</div>
          <Stamp colors={base.colors} seed={base.id} width={110} label={base.name} />
          <span className="tag">{base.energy}</span>
        </div>
        <div className="mix__arrow" aria-hidden="true">
          +
        </div>
        <div className="mix__col">
          <div className="lbl">With {topic === 'none' ? 'no topic' : topics[topic].label}</div>
          <Stamp
            colors={mixed.colors}
            seed={`${base.id}:${topic}`}
            width={110}
            label="Mixed stamp"
          />
          <span className="tag">
            {mixed.tagged ? 'made for this' : mixed.mixed ? 'accents added' : 'plain'}
          </span>
        </div>
      </div>

      <button className="shuffle" onClick={() => setShuffle((s) => s + 1)}>
        Shuffle · {poolSize} palettes for {feelings[feeling].label.toLowerCase()}
      </button>

      <Swatches colors={mixed.colors} label="Mixed colors" />
    </>
  )
}

/** Palettes grouped by what they were made for: seasons, party, date, food, travel... */
function ThemesView() {
  const [theme, setTheme] = useState('autumn')
  const shown = ALL.filter((p) => p.topics?.includes(theme))
  return (
    <>
      <p className="screen__note">
        Palettes made for a particular kind of day. When a note matches the theme, one of these is
        preferred over a general palette.
      </p>
      <div className="chips" role="group" aria-label="Theme">
        {THEME_IDS.map((t) => (
          <button key={t} className={theme === t ? 'on' : ''} onClick={() => setTheme(t)}>
            {topics[t].label} · {THEME_COUNTS[t]}
          </button>
        ))}
      </div>
      <section className="family">
        <h2>{topics[theme].label}</h2>
        {shown.map((p) => (
          <PaletteCard key={p.id} palette={p} feeling={p.feeling} />
        ))}
      </section>
    </>
  )
}

function FeelingsView() {
  const [feeling, setFeeling] = useState('all')
  const shown = feeling === 'all' ? FEELING_IDS : [feeling]
  const total = Object.values(palettes).flat().length

  return (
    <>
      <div className="chips" role="group" aria-label="Feeling">
        <button className={feeling === 'all' ? 'on' : ''} onClick={() => setFeeling('all')}>
          All · {total}
        </button>
        {FEELING_IDS.map((f) => (
          <button key={f} className={feeling === f ? 'on' : ''} onClick={() => setFeeling(f)}>
            {feelings[f].label} · {palettes[f].length}
          </button>
        ))}
      </div>

      {shown.map((f) => (
        <section key={f} className="family">
          <h2>{feelings[f].label}</h2>
          <p className="blurb">{feelings[f].blurb}</p>
          <details className="words">
            <summary>{feelings[f].keywords.length} words that mean this</summary>
            <div className="kw">
              {feelings[f].keywords.map((k) => (
                <span key={k}>{k}</span>
              ))}
            </div>
          </details>
          {palettes[f].map((p) => (
            <PaletteCard key={p.id} palette={p} />
          ))}
        </section>
      ))}

      <section className="family">
        <h2>When nothing matches</h2>
        <p className="blurb">
          The feeling falls back to <b>{feelings[defaultFeeling].label}</b>.
        </p>
      </section>
    </>
  )
}

function PaletteCard({ palette, feeling }) {
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
        <h3>
          {palette.name} {palette.energy === 'vivid' && <span className="tag">vivid</span>}
          {feeling && <span className="tag">{feelings[feeling].label}</span>}
        </h3>
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

function TopicsView() {
  const { activeProfile, profiles } = fallback
  return (
    <>
      <p className="screen__note">
        {Object.keys(topics).length} topics. Each has words that trigger it and three accent colors
        that join the palette.
      </p>
      {Object.entries(GROUPS).map(([group, ids]) => (
        <section key={group} className="family">
          <h2>{group}</h2>
          {ids.map((id) => {
            const t = topics[id]
            return (
              <article key={id} className="topic">
                <div className="topic__head">
                  <h3>{t.label}</h3>
                  <div className="topic__accents" aria-label="Accent colors">
                    {t.accents.map((a) => (
                      <i key={a} style={{ background: a }} title={a} />
                    ))}
                  </div>
                </div>
                <details className="words">
                  <summary>{t.keywords.length} words</summary>
                  <div className="kw">
                    {t.keywords.map((k) => (
                      <span key={k}>{k}</span>
                    ))}
                  </div>
                </details>
              </article>
            )
          })}
        </section>
      ))}

      <section className="family">
        <h2>When nothing matches</h2>
        <p className="blurb">
          The topic comes from the time of day, then the month (profile: <b>{activeProfile}</b>).
        </p>
        {Object.entries(profiles).map(([name, p]) => (
          <div key={name} className="fb">
            <b>{name}</b>
            <span>
              {Object.entries(p.monthTopic)
                .map(([m, t]) => `${m}: ${topics[t].label}`)
                .join(' · ')}
            </span>
          </div>
        ))}
      </section>
    </>
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
