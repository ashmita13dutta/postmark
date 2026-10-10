import './moods.css'

/** A mood's five colors as one small strip, to tell moods apart at a glance. */
export default function MoodStrip({ mood }) {
  return (
    <span className="moodstrip" aria-hidden="true">
      {mood.colors.map((c, i) => (
        <i key={i} style={{ background: c.hex }} />
      ))}
    </span>
  )
}
