import { useLiveQuery } from 'dexie-react-hooks'
import { useState } from 'react'
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom'
import Screen from '../app/Screen'
import '../components/demo/demo.css'
import { SAMPLE_NOTES, demo } from '../db/demo'
import { queries } from '../db/queries'
import { addDays, todayKey } from '../lib/dates'
import { Editor } from './Today'

const isDay = (s) => /^\d{4}-\d{2}-\d{2}$/.test(s)

/**
 * Make a demo postcard of your own (or change one): write any note, see what the app reads and the
 * colors it picks, fix them, then go on to stick stickers on it. It lands in the Mailbox already
 * delivered, so the whole path (note, mood, palette, stickers, opening) can be tried in a minute.
 */
export default function DemoPostcard() {
  const { id } = useParams()
  // where to start: the postcard being changed, or the nearest free day before today
  const start = useLiveQuery(async () => {
    if (!id) return { moment: null, day: await demo.freeDay() }
    const moment = await queries.getMoment(id)
    return moment?.demo ? { moment, day: moment.day } : null
  }, [id])
  if (start === undefined) return <Screen caption="Testing tools" title="Demo postcard" />
  if (start === null) return <Navigate to="/you" replace />
  return <Maker key={id ?? 'new'} start={start} />
}

function Maker({ start }) {
  const navigate = useNavigate()
  const editing = start.moment
  const yesterday = addDays(todayKey(), -1)
  const [day, setDay] = useState(start.day)
  const [opened, setOpened] = useState(editing ? editing.openedAt != null : false)
  // whatever already sits on the chosen day (undefined while it loads)
  const taken = useLiveQuery(async () => (await queries.getMomentByDay(day)) ?? null, [day])
  const clash = !editing && taken ? taken : null

  const controls = (
    <section className="demo__pick" aria-label="About this demo postcard">
      {!editing && (
        <label className="demo__field">
          <span className="lbl">Day it is from</span>
          <input
            type="date"
            value={day}
            max={yesterday}
            onChange={(e) => {
              const v = e.target.value
              if (isDay(v)) setDay(v > yesterday ? yesterday : v)
            }}
          />
        </label>
      )}
      <label className="demo__check">
        <input type="checkbox" checked={opened} onChange={(e) => setOpened(e.target.checked)} />
        Already opened
        <small>Leave this off to try the opening ritual in the Mailbox.</small>
      </label>
      {clash && (
        <p className="demo__msg demo__msg--err" role="status">
          {clash.demo ? (
            <>
              There is already a demo postcard on this day.{' '}
              <Link to={`/you/demo/${clash.id}`}>Change that one</Link>, or pick another day.
            </>
          ) : (
            'You already have a real postcard on this day. Pick another day.'
          )}
        </p>
      )}
      <p className="demo__help">
        Saved as a demo postcard (stamp No. 0), so your real stamps are untouched. Remove it any
        time from the testing tools on You.
      </p>
    </section>
  )

  const config = {
    controls,
    blocked: taken === undefined || clash !== null,
    samples: SAMPLE_NOTES,
    onSave: async (fields) => {
      const moment = await demo.savePostcard({ day, opened, ...fields })
      navigate(`/you/demo/${moment.id}/stickers`)
    },
  }

  return <Editor day={day} existing={editing} demo={config} />
}
