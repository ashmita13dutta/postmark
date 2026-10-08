import './screen.css'

/**
 * Shared page frame: mono caption, serif title, content, and room above the tab bar.
 * `action` (optional) sits at the top right of the header, e.g. a "Seal & send" button.
 */
export default function Screen({ caption, title, action, children }) {
  return (
    <main className="screen">
      <header>
        <div className="lbl">{caption}</div>
        <h1>{title}</h1>
        {action && <div className="screen__action">{action}</div>}
      </header>
      {children}
    </main>
  )
}
