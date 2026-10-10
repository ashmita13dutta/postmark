import { useLiveQuery } from 'dexie-react-hooks'
import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import Screen from '../app/Screen'
import WaxSeal from '../components/postcard/WaxSeal'
import MoodStrip from '../components/moods/MoodStrip'
import ReaderCard from '../components/reader/ReaderCard'
import Stamp from '../components/stamp/Stamp'
import TeachPanel from '../components/teach/TeachPanel'
import { feelings } from '../data/feelings.json'
import { prompts } from '../data/prompts.json'
import { topics } from '../data/topics.json'
import { BLANK_PALETTE } from '../db/moments'
import { queries } from '../db/queries'
import { buildLexicon, contextAt } from '../engine/mood'
import { buildMoods, isMyMood, moodLabel } from '../engine/moods'
import { setSwatch } from '../engine/palette'
import { classify } from '../engine/reader/client'
import { useReader } from '../engine/reader/useReader'
import { readNote } from '../engine/readNote'
import { now } from '../lib/clock'
import { dayOfYear, parseDay, todayKey } from '../lib/dates'
import { yearAgoLetter } from '../lib/mailbox'
import { currentStreak } from '../lib/streak'
import './today.css'

const FEELING_IDS = Object.keys(feelings)
const NO_ROWS = []
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

// "8 Oct 2025": a day with its year, for postcards from a past year
function longAgo(day) {
  const { y, m, d } = parseDay(day)
  return new Date(y, m - 1, d).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
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

/**
 * The note editor. `demo` turns it into the demo-postcard editor on You (src/screens/DemoPostcard.jsx):
 * the same reading, stamp, colors and "Not quite?" fixes, but for a past day, saved as a demo
 * postcard, and without the real streak, year-ago banner or taught corrections.
 *   demo = { controls, blocked, samples, onSave(fields) }
 *     controls: extra content under the title (the date picker)
 *     blocked:  true while this day cannot take a demo postcard
 *     samples:  notes to offer under the box
 *     onSave:   saves `fields` ({ note, feeling, topic, palette, paletteSource }) and moves on
 */
export function Editor({ day, existing, demo }) {
  const now_ = contextAt(now())
  // a past day's colors follow that day's season; the hour is still the hour you are testing at
  const clock = demo ? { ...now_, month: parseDay(day).m } : now_
  const [text, setText] = useState(existing?.note ?? '')
  const [override, setOverride] = useState(
    existing ? { feeling: existing.feeling, topic: existing.topic } : {},
  )
  // five colors you changed by hand; null means "let the app pick them"
  const [custom, setCustom] = useState(
    existing?.paletteSource === 'manual' ? existing.palette : null,
  )
  const [fixing, setFixing] = useState(false)
  // the on-device reader's latest reading of the note: { text, vector, probs }, or { text, none: true }
  // when it could not read it
  const [read, setRead] = useState(null)
  // what you did about the feeling this visit: 'set' (picked one), 'clear' (took the app's), or null
  const [intent, setIntent] = useState(null)
  const reader = useReader()
  const [status, setStatus] = useState(null)
  const [busy, setBusy] = useState(false)
  const [sample, setSample] = useState(0)
  const navigate = useNavigate()

  const days = useLiveQuery(async () => (await queries.allMoments()).map((m) => m.day), [], [])
  const nextNo = useLiveQuery(() => queries.nextStampNo(), [existing], 1)
  // a postcard from exactly a year ago, once it has been delivered (spec 6.4)
  const yearAgo = useLiveQuery(
    async () => yearAgoLetter(await queries.deliveredMoments(now()), day) ?? null,
    [day],
    null,
  )
  const lexiconRows = useLiveQuery(() => queries.getLexicon(), [], [])
  // the moods you made up, and the words you taught them (read together, so a word is only known
  // while its mood exists)
  const moodRows = useLiveQuery(() => queries.getMoods(), [], NO_ROWS)
  // notes you corrected on other days (today's own does not count towards itself)
  const corrections = useLiveQuery(
    async () => (await queries.getCorrections()).filter((c) => c.id !== day),
    [day],
    [],
  )
  const moods = useMemo(() => buildMoods(moodRows), [moodRows])
  const lexicon = useMemo(() => buildLexicon(lexiconRows, moods), [lexiconRows, moods])

  const hasNote = text.trim().length > 0
  const r = useMemo(
    () =>
      readNote({
        text,
        day,
        hour: clock.hour,
        month: clock.month,
        lexicon,
        override,
        reader: hasNote && read && !read.none ? read : null,
        corrections,
        moods,
      }),
    [text, hasNote, day, clock.hour, clock.month, lexicon, override, read, corrections, moods],
  )
  const sealed = !demo && existing?.sealedAt != null
  // Stamp it waits a moment after you stop typing, until the reader has read what is in the box, so
  // the saved feeling never comes from a slightly older version of the note
  const waitingOnReader =
    reader.status === 'ready' && !sealed && hasNote && read?.text !== text.trim()

  // let the reader read the note whenever typing pauses (the stamp keeps its last reading meanwhile)
  useEffect(() => {
    const note = text.trim()
    if (reader.status !== 'ready' || sealed || !note) return
    let live = true
    const timer = setTimeout(async () => {
      const giveUp = new Promise((resolve) => setTimeout(() => resolve(null), 8000))
      const result = await Promise.race([classify(note), giveUp]).catch(() => null)
      if (live) setRead(result ? { text: note, ...result } : { text: note, none: true })
    }, 450)
    return () => {
      live = false
      clearTimeout(timer)
    }
  }, [text, reader.status, sealed])
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

  // the reader's next two guesses, one tap away (the right feeling is among its top three about
  // 95% of the time)
  const alternatives = r.guess.ranked.some((a) => a.p != null)
    ? r.guess.ranked.filter((a) => a.id !== r.feeling && !isMyMood(a.id)).slice(0, 2)
    : []

  const streak = currentStreak(days, day)
  const prompt = prompts[dayOfYear(day) % prompts.length]

  function pickFeeling(id) {
    const same = id === r.guess.feeling
    setOverride((o) => ({ ...o, feeling: same ? undefined : id }))
    setIntent(same ? 'clear' : 'set')
    setCustom(null)
  }
  function pickTopic(id) {
    setOverride((o) => ({ ...o, topic: !id || id === r.mood.topic ? undefined : id }))
    setCustom(null)
  }
  function recolor(i, hex) {
    setCustom(setSwatch(palette, i, hex).palette)
  }

  // Keep a feeling you chose (with the note's exact words) so a near-identical note follows it, or
  // forget it if you went back to the app's own reading. Never blocks stamping.
  async function rememberCorrection() {
    try {
      if (intent === 'clear') await queries.clearCorrection(day)
      // the reader cannot learn a mood you made up, so an older correction for today no longer holds
      else if (intent === 'set' && isMyMood(override.feeling)) await queries.clearCorrection(day)
      else if (intent === 'set' && override.feeling && override.feeling !== r.guess.feeling) {
        const result = await classify(text.trim())
        if (result) {
          await queries.saveCorrection(day, {
            text: text.trim(),
            vector: result.vector,
            guess: r.guess.feeling,
            feeling: override.feeling,
          })
        }
      }
    } catch {
      /* the stamp matters more than the memory */
    } finally {
      setIntent(null)
    }
  }

  async function stampIt() {
    setBusy(true)
    setStatus(null)
    try {
      const fields = {
        note: text.trim(),
        feeling: r.feeling,
        topic: r.topic,
        palette,
        paletteSource: custom ? 'manual' : 'moment',
      }
      if (demo) {
        await demo.onSave(fields)
        return
      }
      const m = await queries.saveMoment(day, fields)
      await rememberCorrection()
      setStatus({ ok: true, text: `Stamped as No. ${m.stampNo}. You can still change it today.` })
      navigate('/reveal')
    } catch (err) {
      setStatus({ ok: false, text: err.message })
    } finally {
      setBusy(false)
    }
  }

  return (
    <Screen caption={dateLine(day)} title={demo ? 'Demo postcard' : greeting(clock.hour)}>
      {demo ? (
        demo.controls
      ) : (
        <p className="today__streak">
          {streak > 0 ? `${streak}-day streak. Keep it going.` : 'Stamp today to start a streak.'}
        </p>
      )}
      {!demo && yearAgo && (
        <Link className="today__letter" to="/mailbox">
          A letter from past you arrived
          <small>From {longAgo(yearAgo.day)}</small>
        </Link>
      )}

      <ReaderCard />

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
          onChange={(e) => {
            setText(e.target.value)
            if (!e.target.value.trim()) setRead(null)
          }}
          rows={5}
          placeholder={prompt}
          aria-label="Your note"
        />
      )}
      {demo?.samples && (
        <button
          className="today__link"
          onClick={() => {
            setText(demo.samples[sample % demo.samples.length])
            setSample((i) => i + 1)
            setOverride({})
            setCustom(null)
          }}
        >
          Fill in a sample note
        </button>
      )}

      <div className="today__stage">
        <Stamp
          colors={palette.map((c) => c.hex)}
          no={existing?.stampNo ?? (demo ? 0 : nextNo)}
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
              <b>{moodLabel(r.feeling, moods)}</b>
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
          {!fixing && alternatives.length > 0 && (
            <div className="today__alts" role="group" aria-label="Or did it feel">
              <span className="lbl">Or</span>
              {alternatives.map((a) => (
                <button key={a.id} onClick={() => pickFeeling(a.id)}>
                  {feelings[a.id].label}
                </button>
              ))}
            </div>
          )}
          {(r.corrected.feeling || r.corrected.topic) && !fixing && (
            <p className="today__fixed">
              You set this. The app read “{moodLabel(r.guess.feeling, moods)}”.
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
                    {r.guess.feeling === f && <small> · app’s guess</small>}
                  </button>
                ))}
                {[...moods.values()].map((m) => (
                  <button
                    key={m.id}
                    className={r.feeling === m.id ? 'on' : ''}
                    aria-pressed={r.feeling === m.id}
                    onClick={() => pickFeeling(m.id)}
                  >
                    <MoodStrip mood={m} /> {m.label}
                    {r.guess.feeling === m.id && <small> · app’s guess</small>}
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
                <button
                  className="today__link"
                  onClick={() => {
                    setOverride({})
                    setIntent('clear')
                  }}
                >
                  Let the app read it again
                </button>
              )}
              <TeachPanel
                text={text}
                mood={{ ...r.mood, feeling: r.guess.feeling }}
                lexicon={lexicon}
                moods={moods}
                onCreateMood={(input) => queries.saveMood(input)}
                onSave={async (entries) => {
                  const saved = await queries.teachWords(entries)
                  // if you had picked a feeling by hand, you now mean the mood you just taught; if
                  // not, the note is simply read again with its new word
                  const mine = saved.find((e) => e.kind === 'feeling' && isMyMood(e.id))
                  if (mine && override.feeling) {
                    setOverride((o) => ({ ...o, feeling: mine.id }))
                    setIntent('set')
                    setCustom(null)
                  }
                  return saved
                }}
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
        <button
          className="today__stamp"
          onClick={stampIt}
          disabled={!hasNote || busy || sealed || waitingOnReader || demo?.blocked}
        >
          {sealed
            ? 'Sealed'
            : waitingOnReader
              ? 'Reading…'
              : demo
                ? 'Save & add stickers'
                : saved
                  ? 'Stamped ✓'
                  : existing
                    ? 'Update stamp'
                    : 'Stamp it'}
        </button>
      </div>
    </Screen>
  )
}
