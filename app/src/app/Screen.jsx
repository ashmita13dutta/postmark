import { useEffect, useRef, useState } from 'react'
import './screen.css'

/**
 * Shared page frame: mono caption, serif title, content, and room above the tab bar.
 * `action` (optional) sits at the top right of the header, e.g. a "Seal & send" button.
 *
 * iOS large-title behaviour: the big title scrolls away with the page, and once it is out of sight
 * a small copy of it fades into a blurred bar at the top, so content slides under frosted glass.
 */
export default function Screen({ caption, title, action, children }) {
  const titleRef = useRef(null)
  const [collapsed, setCollapsed] = useState(false)

  useEffect(() => {
    const el = titleRef.current
    if (!el || typeof IntersectionObserver === 'undefined') return undefined
    // the root's top edge is pushed down by the height of the small bar, so "visible" means
    // "visible below the bar"
    const io = new IntersectionObserver(([entry]) => setCollapsed(!entry.isIntersecting), {
      rootMargin: '-56px 0px 0px 0px',
    })
    io.observe(el)
    return () => io.disconnect()
  }, [])

  return (
    <main className="screen">
      {/* decorative copy of the title; the real heading below is what screen readers get */}
      <div className={collapsed ? 'navbar navbar--on' : 'navbar'} aria-hidden="true">
        <span>{title}</span>
      </div>
      <header>
        <div className="lbl">{caption}</div>
        <h1 ref={titleRef}>{title}</h1>
        {action && <div className="screen__action">{action}</div>}
      </header>
      {children}
    </main>
  )
}
