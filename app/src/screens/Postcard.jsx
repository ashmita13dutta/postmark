import { useReducedMotion } from 'framer-motion'
import { useLiveQuery } from 'dexie-react-hooks'
import { useCallback, useEffect, useState } from 'react'
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom'
import Screen from '../app/Screen'
import DecorLayer from '../components/postcard/DecorLayer'
import PostcardCard, {
  PostcardBack,
  PostcardFront,
  shortDate,
} from '../components/postcard/PostcardCard'
import SealPicker from '../components/postcard/SealPicker'
import SealSequence from '../components/postcard/SealSequence'
import Tray from '../components/postcard/Tray'
import WaxSeal from '../components/postcard/WaxSeal'
import { PostcardFullError, queries } from '../db/queries'
import { now } from '../lib/clock'
import { daysUntil, todayKey } from '../lib/dates'
import { dropSpot, dropTilt } from '../lib/decor'
import './postcard.css'

const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`
/** Today's postcard: flip it over, decorate the back, then seal it with wax and send it off. */
export default function Postcard() {
  const day = todayKey()
  const intent = useLocation().state?.intent // 'flip' | 'seal' | nothing
  const moment = useLiveQuery(async () => (await queries.getMomentByDay(day)) ?? null, [day])
  if (moment === undefined) return <Screen caption="Postcard" title=" " />
  // nothing stamped today, so there is no postcard yet
  if (moment === null) return <Navigate to="/" replace />
  return <Board key={moment.id} moment={moment} intent={intent} />
}

function Board({ moment, intent }) {
  const navigate = useNavigate()
  const reduced = useReducedMotion()
  const sealed = moment.sealedAt != null
  const palette = moment.palette

  const decorations = useLiveQuery(() => queries.decorationsFor(moment.id), [moment.id], [])
  const seal = useLiveQuery(() => queries.getSeal(moment.id), [moment.id, sealed])

  // arriving from "Flip to read" starts on the front and turns over; otherwise start on the back
  const [flipped, setFlipped] = useState(intent !== 'flip')
  const [selectedId, setSelectedId] = useState(null)
  const [message, setMessage] = useState(null)
  const [phase, setPhase] = useState(intent === 'seal' && !sealed ? 'pick' : null) // null | 'pick' | 'play'
  const [sealing, setSealing] = useState(null) // the wax chosen, while the send-off plays
  const [busy, setBusy] = useState(false)
  const [sealError, setSealError] = useState(null)

  useEffect(() => {
    if (intent !== 'flip') return
    const t = setTimeout(() => setFlipped(true), 450)
    return () => clearTimeout(t)
  }, [intent])

  useEffect(() => {
    if (!message) return
    const t = setTimeout(() => setMessage(null), 2600)
    return () => clearTimeout(t)
  }, [message])

  const selected = decorations.find((d) => d.id === selectedId)
  const showBack = flipped && !sealed

  const fail = (err) => setMessage(err.message)

  async function pick(stickerId) {
    setFlipped(true)
    const n = decorations.length
    try {
      const deco = await queries.addDecoration(moment.id, {
        stickerId,
        ...dropSpot(n, `${moment.id}:${n}`),
        rotation: dropTilt(`${moment.id}:${n}:${stickerId}`),
      })
      setSelectedId(deco.id)
    } catch (err) {
      setMessage(
        err instanceof PostcardFullError
          ? 'Your postcard is full. Remove one to add another.'
          : err.message,
      )
    }
  }

  const change = (id, patch, opts) =>
    queries.updateDecoration(id, { ...patch, front: opts?.front }).catch(fail)

  async function remove() {
    const id = selectedId
    setSelectedId(null)
    await queries.removeDecoration(id).catch(fail)
  }

  async function doSeal(wax) {
    setBusy(true)
    setSealError(null)
    try {
      await queries.sealMoment(moment.id, wax)
      setSealing(wax)
      setPhase(null)
      if (reduced) navigate('/', { replace: true })
      else setPhase('play')
    } catch (err) {
      setSealError(err.message)
    } finally {
      setBusy(false)
    }
  }

  const done = useCallback(() => navigate('/', { replace: true }), [navigate])
  const dueIn = daysUntil(moment.sealedUntil, now())
  const sealedUntil = new Date(moment.sealedUntil).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
  })

  return (
    <Screen
      caption={`From ${shortDate(moment.day)}`}
      title="Your postcard"
      action={
        !sealed && (
          <button className="pc__sendbtn" onClick={() => setPhase('pick')}>
            Seal &amp; send
          </button>
        )
      }
    >
      <div onClick={() => setSelectedId(null)}>
        <PostcardCard
          flipped={showBack}
          onFrontClick={sealed ? undefined : () => setFlipped(true)}
          front={
            <PostcardFront moment={moment}>
              {sealed && seal ? (
                <div className="pcard__wax">
                  <WaxSeal
                    color={seal.color}
                    emblem={seal.emblem}
                    initial={seal.initial}
                    size={62}
                  />
                </div>
              ) : null}
              <p className="pcard__cap">
                {sealed ? `Sealed until ${sealedUntil} · ${plural(dueIn, 'day')}` : 'Tap to flip'}
              </p>
            </PostcardFront>
          }
          back={
            <PostcardBack moment={moment}>
              <DecorLayer
                decorations={decorations}
                palette={palette}
                selectedId={selectedId}
                locked={sealed}
                onSelect={setSelectedId}
                onChange={change}
              />
            </PostcardBack>
          }
        />
      </div>

      {sealed ? (
        <div className="pc__done">
          <p>Sealed. It arrives {sealedUntil}, and the note stays hidden until then.</p>
          <Link className="pc__home" to="/">
            Back to Today
          </Link>
        </div>
      ) : (
        <div className="pc__controls">
          {selected ? (
            <div className="pc__tools" role="toolbar" aria-label="Edit sticker">
              <button
                onClick={() => change(selected.id, { rotation: selected.rotation - 15 })}
                aria-label="Turn left"
              >
                ⟲
              </button>
              <button
                onClick={() => change(selected.id, { rotation: selected.rotation + 15 })}
                aria-label="Turn right"
              >
                ⟳
              </button>
              <button
                onClick={() => change(selected.id, { scale: selected.scale / 1.15 })}
                aria-label="Smaller"
              >
                −
              </button>
              <button
                onClick={() => change(selected.id, { scale: selected.scale * 1.15 })}
                aria-label="Bigger"
              >
                +
              </button>
              <button className="pc__remove" onClick={remove}>
                Remove
              </button>
            </div>
          ) : (
            <button className="pc__flip" onClick={() => setFlipped((f) => !f)}>
              {showBack ? 'Show the front' : 'Flip to the back'}
            </button>
          )}
          {message && (
            <p className="pc__msg" role="status">
              {message}
            </p>
          )}
        </div>
      )}

      {!sealed && <Tray palette={palette} onPick={pick} />}

      {phase === 'pick' && (
        <SealPicker
          busy={busy}
          error={sealError}
          onSeal={doSeal}
          onCancel={() => {
            setPhase(null)
            setSealError(null)
          }}
        />
      )}
      {phase === 'play' && sealing && <SealSequence moment={moment} seal={sealing} onDone={done} />}
    </Screen>
  )
}
