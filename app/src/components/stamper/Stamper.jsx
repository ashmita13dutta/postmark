import { motion } from 'framer-motion'
import './stamper.css'

/**
 * A wooden rubber stamper that comes in at an angle, flattens onto the paper, holds, and lifts
 * away. Drawn in SVG with gradients for a lathe-turned, 3D look; only transform and opacity animate.
 *
 * Place it inside a 112x112 box whose centre is where the print lands: the stamper's face sits on
 * that centre, and the handle rises above it.
 *
 * Props:
 *  - delay:    seconds before it starts moving in
 *  - duration: seconds for the whole in, press, hold, out trip (the press lands 60% of the way in
 *              and the hold ends at 75%, so the print should appear at delay + 0.75 * duration)
 */
export const STAMPER_TIMES = { press: 0.6, lift: 0.75 }

// the face centre in the SVG's own pixels (viewBox starts at x -6, y -135)
const ORIGIN = '62px 191px'

export default function Stamper({ delay = 0.4, duration = 1 }) {
  const times = [0, 0.4, STAMPER_TIMES.press, STAMPER_TIMES.lift, 1]
  const t = { duration, delay, times, ease: ['easeOut', 'easeIn', 'linear', 'easeIn'] }
  return (
    <div className="stamper" aria-hidden="true">
      {/* soft contact shadow on the paper: fades in as the stamper nears, tightens as it lands */}
      <motion.div
        className="stamper__shadow"
        initial={{ opacity: 0, scale: 1.5 }}
        animate={{ opacity: [0, 0.18, 0.5, 0.5, 0], scale: [1.5, 1.25, 1, 1, 1.4] }}
        transition={t}
      />
      <motion.svg
        className="stamper__body"
        viewBox="-6 -135 124 247"
        width="124"
        height="247"
        style={{ transformOrigin: ORIGIN }}
        initial={{ opacity: 0, x: 70, y: -110, rotate: -30, scale: 1.1 }}
        animate={{
          opacity: [0, 1, 1, 1, 0],
          x: [70, 18, 0, 0, -26],
          y: [-110, -42, 0, 0, -70],
          rotate: [-30, -13, 0, 0, 12],
          scale: [1.1, 1.05, 0.985, 0.985, 1.06],
        }}
        transition={{ ...t, opacity: { ...t, times: [0, 0.2, 0.75, 0.9, 1], ease: 'linear' } }}
      >
        <defs>
          <linearGradient id="st-wood" x1="0" x2="1">
            <stop offset="0" stopColor="#b9814f" />
            <stop offset="0.35" stopColor="#8f5c35" />
            <stop offset="1" stopColor="#4e2e1a" />
          </linearGradient>
          <radialGradient id="st-knob" cx="0.34" cy="0.3" r="0.8">
            <stop offset="0" stopColor="#d79b66" />
            <stop offset="0.45" stopColor="#9a6238" />
            <stop offset="1" stopColor="#4a2a17" />
          </radialGradient>
          <linearGradient id="st-metal" x1="0" x2="1">
            <stop offset="0" stopColor="#f4f6f8" />
            <stop offset="0.3" stopColor="#c7ccd2" />
            <stop offset="0.6" stopColor="#8a9199" />
            <stop offset="1" stopColor="#5f666d" />
          </linearGradient>
          <linearGradient id="st-plate" x1="0" x2="1">
            <stop offset="0" stopColor="#5a463d" />
            <stop offset="0.5" stopColor="#2f2623" />
            <stop offset="1" stopColor="#1b1513" />
          </linearGradient>
          <radialGradient id="st-top" cx="0.35" cy="0.3" r="0.9">
            <stop offset="0" stopColor="#6a544a" />
            <stop offset="1" stopColor="#2a211e" />
          </radialGradient>
        </defs>

        {/* base plate: dark block, side then top face */}
        <path d="M-2 50 V62 A58 50 0 0 0 114 62 V50 Z" fill="url(#st-plate)" />
        <ellipse cx="56" cy="50" rx="58" ry="50" fill="url(#st-top)" />
        <ellipse cx="56" cy="50" rx="58" ry="50" fill="none" stroke="#000" strokeOpacity=".35" />
        {/* a rim of ink where the rubber peeks out underneath */}
        <path
          d="M2 66 A56 47 0 0 0 110 66"
          fill="none"
          stroke="#534ab7"
          strokeWidth="2.5"
          strokeOpacity=".75"
        />

        {/* metal collar */}
        <path d="M26 46 V28 A30 26 0 0 0 86 28 V46 A30 26 0 0 1 26 46 Z" fill="url(#st-metal)" />
        <ellipse cx="56" cy="28" rx="30" ry="26" fill="#aeb4ba" />
        <ellipse cx="56" cy="28" rx="30" ry="26" fill="none" stroke="#fff" strokeOpacity=".6" />
        <ellipse cx="56" cy="26" rx="19" ry="15" fill="#6b7279" />

        {/* turned wooden neck with lathe grooves */}
        <path d="M42 26 V-70 H70 V26 A14 8 0 0 1 42 26 Z" fill="url(#st-wood)" />
        <ellipse cx="56" cy="-70" rx="14" ry="6" fill="#7b4c2b" />
        <g stroke="#2e1a0e" strokeOpacity=".55" strokeWidth="1.4" fill="none">
          <path d="M42 -2 A14 6 0 0 0 70 -2" />
          <path d="M42 -12 A14 6 0 0 0 70 -12" />
          <path d="M42 -38 A14 6 0 0 0 70 -38" />
        </g>
        <g stroke="#f3c999" strokeOpacity=".4" strokeWidth="1" fill="none">
          <path d="M42 -1 A14 6 0 0 0 70 -1" />
          <path d="M42 -37 A14 6 0 0 0 70 -37" />
        </g>
        <rect x="46" y="-66" width="3" height="88" fill="#fff" opacity=".18" />

        {/* round knob */}
        <ellipse cx="56" cy="-92" rx="38" ry="34" fill="url(#st-knob)" />
        <ellipse
          cx="42"
          cy="-106"
          rx="13"
          ry="8"
          fill="#fff"
          opacity=".28"
          transform="rotate(-24 42 -106)"
        />
        <ellipse cx="56" cy="-92" rx="38" ry="34" fill="none" stroke="#000" strokeOpacity=".3" />
      </motion.svg>
    </div>
  )
}
