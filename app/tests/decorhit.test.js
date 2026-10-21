import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const css = readFileSync(new URL('../src/components/postcard/decor.css', import.meta.url), 'utf8')

describe('which face of the card takes taps', () => {
  it('lets no tap through to the face that is turned away', () => {
    // PostcardCard marks the turned-away face aria-hidden. Without this rule the hidden front face's
    // stamp sat in front of the stickers on the back, and a placed sticker could not be tapped again.
    expect(css).toMatch(/\.pcard__face\[aria-hidden=['"]true['"]\]\s*\{[^}]*pointer-events:\s*none/)
  })
})
