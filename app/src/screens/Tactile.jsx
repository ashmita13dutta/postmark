import { useState } from 'react'
import './tactile.css'

/**
 * A look-and-feel test page (route /tactile): one envelope, one wax seal, one button, all lit
 * from the top left so they read as soft physical objects. Nothing here is saved or used by
 * the real screens yet; it is for judging the texture before it spreads through the app.
 */
function Envelope({ open }) {
  return (
    <svg
      className={`tx-env${open ? ' tx-env--open' : ''}`}
      viewBox="0 0 340 250"
      role="img"
      aria-label="An envelope with a wax seal and a ribbon"
    >
      <defs>
        {/* paper grain: fine noise laid over the colour */}
        <filter id="tx-grain" x="0" y="0" width="100%" height="100%">
          <feTurbulence
            type="fractalNoise"
            baseFrequency="0.85"
            numOctaves="2"
            seed="7"
            result="n"
          />
          <feColorMatrix
            in="n"
            type="matrix"
            values="0 0 0 0 0.35  0 0 0 0 0.27  0 0 0 0 0.2  0 0 0 0.5 -0.12"
            result="g"
          />
          <feComposite in="g" in2="SourceGraphic" operator="in" result="gin" />
          <feMerge>
            <feMergeNode in="SourceGraphic" />
            <feMergeNode in="gin" />
          </feMerge>
        </filter>
        {/* padded edges: a soft specular rim from a top-left light, clipped to the shape */}
        <filter id="tx-puff" x="-5%" y="-5%" width="110%" height="110%">
          <feGaussianBlur in="SourceAlpha" stdDeviation="3.2" result="b" />
          <feSpecularLighting
            in="b"
            surfaceScale="4"
            specularConstant="0.8"
            specularExponent="22"
            lightingColor="#fffaf0"
            result="s"
          >
            <feDistantLight azimuth="225" elevation="52" />
          </feSpecularLighting>
          <feComposite in="s" in2="SourceAlpha" operator="in" result="sin" />
          <feMerge>
            <feMergeNode in="SourceGraphic" />
            <feMergeNode in="sin" />
          </feMerge>
        </filter>
        <filter id="tx-drop" x="-20%" y="-20%" width="140%" height="150%">
          <feDropShadow dx="3" dy="9" stdDeviation="9" floodColor="#7a5a3e" floodOpacity="0.28" />
        </filter>
        <filter id="tx-soft" x="-30%" y="-30%" width="160%" height="160%">
          <feGaussianBlur stdDeviation="3" />
        </filter>
        <linearGradient id="tx-body" x1="0" y1="0" x2="0.35" y2="1">
          <stop offset="0" stopColor="#f6e6c4" />
          <stop offset="1" stopColor="#e3c898" />
        </linearGradient>
        <linearGradient id="tx-side-l" x1="0" y1="0" x2="1" y2="0.4">
          <stop offset="0" stopColor="#f1dcb2" />
          <stop offset="1" stopColor="#e4c795" />
        </linearGradient>
        <linearGradient id="tx-side-r" x1="1" y1="0" x2="0" y2="0.4">
          <stop offset="0" stopColor="#e9d0a0" />
          <stop offset="1" stopColor="#d8b987" />
        </linearGradient>
        <linearGradient id="tx-bottom" x1="0" y1="1" x2="0" y2="0">
          <stop offset="0" stopColor="#f8e9c9" />
          <stop offset="1" stopColor="#e6cb9b" />
        </linearGradient>
        <linearGradient id="tx-flap" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#ecd3a1" />
          <stop offset="1" stopColor="#d9bb88" />
        </linearGradient>
        <radialGradient id="tx-wax" cx="0.35" cy="0.3" r="0.85">
          <stop offset="0" stopColor="#ff9db4" />
          <stop offset="0.45" stopColor="#e24c78" />
          <stop offset="1" stopColor="#a8234d" />
        </radialGradient>
        <radialGradient id="tx-wax-rim" cx="0.5" cy="0.5" r="0.5">
          <stop offset="0.82" stopColor="#8f1d41" stopOpacity="0" />
          <stop offset="1" stopColor="#8f1d41" stopOpacity="0.75" />
        </radialGradient>
        <linearGradient id="tx-satin" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#d9c4f2" />
          <stop offset="0.4" stopColor="#a98ad6" />
          <stop offset="0.6" stopColor="#c7aeea" />
          <stop offset="1" stopColor="#8f6fc4" />
        </linearGradient>
        <pattern id="tx-dots" width="16" height="16" patternUnits="userSpaceOnUse">
          <rect width="16" height="16" fill="#fdf4f6" />
          <circle cx="8" cy="8" r="1.7" fill="#f2b3c6" />
        </pattern>
        <g id="tx-flap-shape">
          <g filter="url(#tx-grain)">
            <g filter="url(#tx-puff)">
              <path
                d="M18 76 Q18 66 30 68 L310 68 Q322 66 322 76 L178 188 Q170 194 162 188 Z"
                fill="url(#tx-flap)"
              />
            </g>
          </g>
          <path
            d="M30 70 L170 180"
            stroke="#fff6e0"
            strokeOpacity="0.5"
            strokeWidth="1.2"
            fill="none"
          />
        </g>
      </defs>

      {/* the open flap, folded up behind the letter */}
      <g className="tx-env__flap tx-env__flap--back">
        <use href="#tx-flap-shape" />
      </g>

      {/* the letter, peeking out and rising when opened */}
      <g className="tx-env__card">
        <rect
          x="52"
          y="14"
          width="236"
          height="170"
          rx="8"
          fill="url(#tx-dots)"
          filter="url(#tx-drop)"
        />
        <rect
          x="52"
          y="14"
          width="236"
          height="170"
          rx="8"
          fill="none"
          stroke="#e9c3cf"
          strokeWidth="1"
        />
        <text x="170" y="80" textAnchor="middle" className="tx-env__for">
          for
        </text>
        <text x="170" y="112" textAnchor="middle" className="tx-env__name">
          Aanya
        </text>
      </g>

      {/* body */}
      <g filter="url(#tx-drop)">
        <g filter="url(#tx-grain)">
          <g filter="url(#tx-puff)">
            <rect x="20" y="70" width="300" height="164" rx="10" fill="url(#tx-body)" />
            <path d="M20 80 L170 175 L20 226 Z" fill="url(#tx-side-l)" />
            <path d="M320 80 L170 175 L320 226 Z" fill="url(#tx-side-r)" />
            <path
              d="M20 228 L170 150 L320 228 Q320 234 310 234 L30 234 Q20 234 20 228 Z"
              fill="url(#tx-bottom)"
            />
          </g>
        </g>
      </g>

      {/* the closed flap, over the front of the envelope */}
      <g className="tx-env__flap tx-env__flap--front">
        <use href="#tx-flap-shape" />
      </g>

      {/* ribbon: satin bow tied over the seal */}
      <g className="tx-env__ribbon" filter="url(#tx-drop)">
        <path
          d="M170 150 C130 188 98 214 74 222 L98 238 C124 222 150 190 170 160 Z"
          fill="url(#tx-satin)"
        />
        <path
          d="M170 150 C210 188 242 214 266 222 L242 238 C216 222 190 190 170 160 Z"
          fill="url(#tx-satin)"
        />
        <path d="M170 140 C130 104 96 104 92 128 C90 152 138 156 170 140 Z" fill="url(#tx-satin)" />
        <path
          d="M170 140 C210 104 244 104 248 128 C250 152 202 156 170 140 Z"
          fill="url(#tx-satin)"
        />
        <path
          d="M118 118 C136 112 154 120 164 136"
          stroke="#fff"
          strokeOpacity="0.55"
          strokeWidth="2.4"
          fill="none"
          strokeLinecap="round"
        />
        <path
          d="M222 118 C204 112 186 120 176 136"
          stroke="#fff"
          strokeOpacity="0.45"
          strokeWidth="2.4"
          fill="none"
          strokeLinecap="round"
        />
      </g>

      {/* the wax seal: a glossy dome */}
      <g className="tx-env__seal">
        <ellipse
          cx="173"
          cy="168"
          rx="30"
          ry="9"
          fill="#5b1530"
          opacity="0.35"
          filter="url(#tx-soft)"
        />
        <path
          d="M170 118 c16 -2 32 12 30 30 c4 14 -6 32 -22 34 c-14 6 -32 -4 -34 -18 c-10 -12 -2 -32 14 -38 c4 -4 8 -7 12 -8 Z"
          fill="url(#tx-wax)"
        />
        <path
          d="M170 118 c16 -2 32 12 30 30 c4 14 -6 32 -22 34 c-14 6 -32 -4 -34 -18 c-10 -12 -2 -32 14 -38 c4 -4 8 -7 12 -8 Z"
          fill="url(#tx-wax-rim)"
        />
        <path
          d="M170 168 C150 154 154 138 164 138 C168 138 170 142 170 144 C170 142 172 138 176 138 C186 138 190 154 170 168 Z"
          fill="#c63662"
          stroke="#8f1d41"
          strokeWidth="1.4"
          strokeOpacity="0.5"
        />
        <path
          d="M160 143 C161 140 164 140 166 142"
          stroke="#ffd0dc"
          strokeWidth="2.2"
          fill="none"
          strokeLinecap="round"
          opacity="0.9"
        />
        <ellipse
          cx="156"
          cy="128"
          rx="9"
          ry="5"
          transform="rotate(-32 156 128)"
          fill="#fff"
          opacity="0.55"
        />
        <ellipse
          cx="190"
          cy="172"
          rx="6"
          ry="2.6"
          transform="rotate(-30 190 172)"
          fill="#ff9db4"
          opacity="0.5"
        />
      </g>
    </svg>
  )
}

function Sparkle({ className }) {
  return (
    <svg className={`tx-sparkle ${className}`} viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 1 C12.8 8 16 11.2 23 12 C16 12.8 12.8 16 12 23 C11.2 16 8 12.8 1 12 C8 11.2 11.2 8 12 1 Z" />
    </svg>
  )
}

export default function Tactile() {
  const [open, setOpen] = useState(false)
  return (
    <main className="tx">
      <Sparkle className="tx-sparkle--a" />
      <Sparkle className="tx-sparkle--b" />
      <Sparkle className="tx-sparkle--c" />
      <p className="tx__script">a little something</p>
      <h1 className="tx__title">
        There&rsquo;s something <em>for you</em>
      </h1>
      <p className="tx__sub">A tiny letter, folded just for you.</p>
      <button
        type="button"
        className="tx-env__tap"
        onClick={() => setOpen((o) => !o)}
        aria-pressed={open}
        aria-label={open ? 'Close the envelope' : 'Open the envelope'}
      >
        <Envelope open={open} />
      </button>
      <button type="button" className="tx-btn" onClick={() => setOpen((o) => !o)}>
        <span className="tx-btn__dot" aria-hidden="true" />
        <span className="tx-btn__label">{open ? 'Fold it back' : 'Open your surprise'}</span>
      </button>
      <p className="tx__hint">Tap the envelope or the button.</p>
    </main>
  )
}
