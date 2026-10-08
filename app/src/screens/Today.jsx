import { useLiveQuery } from 'dexie-react-hooks'
import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Screen from '../app/Screen'
import WaxSeal from '../components/postcard/WaxSeal'
import Stamp from '../components/stamp/Stamp'
import TeachPanel from '../components/teach/TeachPanel'
import { feelings } from '../data/feelings.json'
import { prompts } from '../data/prompts.json'
import { topics } from '../data/topics.json'
import { BLANK_PALETTE } from '../db/moments'
import { queries } from '../db/queries'
import { buildLexicon, contextAt } from '../engine/mood'
import { setSwatch } from '../engine/palette'
import { readNote } from '../engine/readNote'
import { now } from '../lib/clock'
import { dayOfYear, parseDay, todayKey } from '../lib/dates'
import { currentStreak } from '../lib/streak'
import './today.css'

const FEELING_IDS = Object.keys(feelings)
// topics grouped for the picker, in file order
const GROUPS = Object.entries(topics).reduce((acc, [id, t]) => {
  ;(acc[t.group] ??= []).push(id)
  return acc
}, {})

function greeting(hour) {
  if (hour < 5) return 'Still up?'
  if (hour < 12) return 'Good morning'
  if (hour < 17) return 'Good afternoon'
  if (hour < 21) return 'Good evening'
  return 'Good night'
}

function dateLine(day) {
  const { y, m, d } = parseDay(day)
  const date = new Date(y, m - 1, d)
  const weekday = date.toLocaleDateString('en-GB', { weekday: 'short' })
  const monthDay = date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
  return `${weekday} · ${monthDay} · Day ${dayOfYear(day)}`
}

/** Today: write the note, see the stamp, fix the mood if it read it wrong, stamp it. */
export default function Today() {
  const day = todayKey()
  // undefined while loading, null when there is no stamp yet today
  const existing = useLiveQuery(async () => (await queries.getMomentByDay(day)) ?? null, [day])
  if (existing === undefined) return <Screen caption="Postmark" title="Today" />
  return <Editor key="editor" day={day} existing={existing} />
}

function Editor({ day, existing }) {
  const clock = contextAt(now())
  const [text, setText] = useState(existing?.note ?? '')
  const [override, setOverride] = useState(
    existing ? { feeling: existing.feeling, topic: existing.topic } : {},
  )
  // five colors you changed by hand; null means "let the app pick them"
  const [custom, setCustom] = useState(
    existing?.paletteSource === 'manual' ? existing.palette : null,
  )
  const [fixing, setFixing] = useState(false)
  const [status, setStatus] = useState(null)
  const [busy, setBusy] = useState(false)
  const navigate = useNavigate()

  const days = useLiveQuery(async () => (await queries.allMoments()).map((m) => m.day), [], [])
  const nextNo = useLiveQuery(() => queries.nextStampNo(), [existing], 1)
  const lexiconRows = useLiveQuery(() => queries.getLexicon(), [], [])
  const lexicon = useMemo(() => buildLexicon(lexiconRows), [lexiconRows])

  const hasNote = text.trim().length > 0
  const r = useMemo(
    () => readNote({ text, day, hour: clock.hour, month: clock.month, lexicon, override }),
    [text, day, clock.hour, clock.month, lexicon, override],
  )
  const sealed = existing?.sealedAt != null
  // once sealed, show the colors that were saved, not a fresh reading of the note
  const palette = sealed ? existing.palette : !hasNote ? BLANK_PALETTE : (custom ?? r.built.colors)
  const seal = useLiveQuery(
    () => (sealed ? queries.getSeal(existing.id) : undefined),
    [sealed, existing?.id],
  )

  const saved =
    existing &&
    existing.note === text.trim() &&
    existing.feeling === r.feeling &&
    existing.topic === r.topic &&
    existing.palette.map((c) => c.hex).join() === palette.map((c) => c.hex).join()

  const streak = currentStreak(days, day)
  const prompt = prompts[dayOfYear(day) % prompts.length]

  function pickFeeling(id) {
    setOverride((o) => ({ ...o, feeling: id === r.mood.feeling ? undefined : id }))
    setCustom(null)
  }
  function pickTopic(id) {
    setOverride((o) => ({ ...o, topic: !id || id === r.mood.topic ? undefined : id }))
    setCustom(null)
  }
  function recolor(i, hex) {
    setCustom(setSwatch(palette, i, hex).palette)
  }

  async function stampIt() {
    setBusy(true)
    setStatus(null)
    try {
      const m = await queries.saveMoment(day, {
        note: text.trim(),
        feeling: r.feeling,
        topic: r.topic,
        palette,
        paletteSource: custom ? 'manual' : 'moment',
      })
      setStatus({ ok: true, text: `Stamped as No. ${m.stampNo}. You can still change it today.` })
      navigate('/reveal')
    } catch (err) {
      setStatus({ ok: false, text: err.message })
    } finally {
      setBusy(false)
    }
  }

  return (
    <Screen caption={dateLine(day)} title={greeting(clock.hour)}>
      <p className="today__streak">
        {streak > 0 ? `${streak}-day streak. Keep it going.` : 'Stamp today to start a streak.'}
      </p>

      {sealed ? (
        // a sealed note is simply not shown until it is delivered (spec 6.2)
        <div className="today__sealed">
          {seal && (
            <WaxSeal color={seal.color} emblem={seal.emblem} initial={seal.initial} size={56} />
          )}
          <p>
            Sealed and on its way. Your note opens on{' '}
            {new Date(existing.sealedUntil).toLocaleDateString('en-GB', {
              day: 'numeric',
              month: 'short',
            })}
            .
          </p>
        </div>
      ) : (
        <textarea
          className="today__note"
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={5}
          placeholder={prompt}
          aria-label="Your note"
        />
      )}

      <div className="today__stage">
        <Stamp
          colors={palette.map((c) => c.hex)}
          no={existing?.stampNo ?? nextNo}
          seed={day}
          width={170}
          label={`Today's stamp: ${palette.map((c) => c.name).join(', ')}`}
        />
      </div>

      <ul className="today__swatches" aria-label="Today's five colors. Tap one to change it.">
        {palette.map((c, i) => (
          <li key={i}>
            <label>
              <span className="today__chip" style={{ background: c.hex }} />
              <input
                type="color"
                value={c.hex.toLowerCase()}
                onChange={(e) => recolor(i, e.target.value)}
                disabled={!hasNote || sealed}
                aria-label={`Change ${c.name}`}
              />
            </label>
            <small>{c.name}</small>
          </li>
        ))}
      </ul>
      {custom && (
        <button className="today__link" onClick={() => setCustom(null)}>
          Back to the colors the app picked
        </button>
      )}

      {hasNote && !sealed && (
        <section className="today__mood" aria-label="What the app read">
          <div className="today__read">
            <div>
              <span className="lbl">Felt</span>
              <b>{feelings[r.feeling].label}</b>
            </div>
            <div>
              <span className="lbl">About</span>
              <b>{topics[r.topic].label}</b>
            </div>
            <button
              className={fixing ? 'today__fixbtn on' : 'today__fixbtn'}
              onClick={() => setFixing((v) => !v)}
              aria-expanded={fixing}
            >
              {fixing ? 'Done' : 'Not quite?'}
            </button>
          </div>
          {(r.corrected.feeling || r.corrected.topic) && !fixing && (
            <p className="today__fixed">
              You set this. The app read “{feelings[r.mood.feeling].label}”.
            </p>
          )}

          {fixing && (
            <div className="today__fix">
              <h2>How did it really feel?</h2>
              <div className="chips chips--wrap" role="group" aria-label="How it really felt">
                {FEELING_IDS.map((f) => (
                  <button
                    key={f}
                    className={r.feeling === f ? 'on' : ''}
                    aria-pressed={r.feeling === f}
                    onClick={() => pickFeeling(f)}
                  >
                    {feelings[f].label}
                    {r.mood.feeling === f && <small> · app’s guess</small>}
                  </button>
                ))}
              </div>
              <h2>What was it about?</h2>
              <select
                className="picker"
                value={r.topic}
                onChange={(e) => pickTopic(e.target.value)}
                aria-label="What it was about"
              >
                {Object.entries(GROUPS).map(([group, ids]) => (
                  <optgroup key={group} label={group}>
                    {ids.map((id) => (
                      <option key={id} value={id}>
                        {topics[id].label}
                        {r.mood.topic === id ? ' (app’s guess)' : ''}
                      </option>
                    ))}
                  </optgroup>
                ))}
              </select>
              {(r.corrected.feeling || r.corrected.topic) && (
                <button className="today__link" onClick={() => setOverride({})}>
                  Let the app read it again
                </button>
              )}
              <TeachPanel
                text={text}
                mood={r.mood}
                lexicon={lexicon}
                onSave={(entries) => queries.teachWords(entries)}
                preset={
                  override.feeling ? { kind: 'feeling', target: override.feeling } : undefined
                }
                label="Teach it the words that show this"
              />
            </div>
          )}
        </section>
      )}

      <div className="today__bar">
        {status && (
          <p
            className={status.ok ? 'today__status' : 'today__status today__status--err'}
            role="status"
          >
            {status.text}
          </p>
        )}
        <button className="today__stamp" onClick={stampIt} disabled={!hasNote || busy || sealed}>
          {sealed ? 'Sealed' : saved ? 'Stamped ✓' : existing ? 'Update stamp' : 'Stamp it'}
        </button>
      </div>
    </Screen>
  )
}
