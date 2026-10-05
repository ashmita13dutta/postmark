import './screen.css'

/** Shared page frame: mono caption, serif title, content, and room above the tab bar. */
export default function Screen({ caption, title, children }) {
  return (
    <main className="screen">
      <header>
        <div className="lbl">{caption}</div>
        <h1>{title}</h1>
      </header>
      {children}
    </main>
  )
}
