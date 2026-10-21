import { describe, expect, it } from 'vitest'
import { photoAccept, sniffFormat, unreadableMessage } from '../src/lib/photoFormat'

const bytes = (...values) => Uint8Array.from(values)
const text = (s) => [...s].map((c) => c.charCodeAt(0))
/** An ISO media file head: a size, 'ftyp' and a brand. */
const iso = (brand) =>
  bytes(0, 0, 0, 24, ...text('ftyp'), ...text(brand), 0, 0, 0, 0, ...text(brand))

describe('sniffFormat', () => {
  it('knows the common picture formats from their first bytes', () => {
    expect(sniffFormat(bytes(0xff, 0xd8, 0xff, 0xe0, 0, 16))).toBe('jpeg')
    expect(sniffFormat(bytes(0x89, ...text('PNG'), 13, 10, 26, 10))).toBe('png')
    expect(sniffFormat(bytes(...text('GIF89a'), 1, 0))).toBe('gif')
    expect(sniffFormat(bytes(...text('RIFF'), 1, 2, 3, 4, ...text('WEBP'), ...text('VP8 ')))).toBe(
      'webp',
    )
    expect(sniffFormat(bytes(0x42, 0x4d, 1, 2, 3, 4))).toBe('bmp')
    expect(sniffFormat(bytes(0x49, 0x49, 0x2a, 0, 8, 0, 0, 0))).toBe('tiff')
    expect(sniffFormat(bytes(0x4d, 0x4d, 0, 0x2a, 0, 0, 0, 8))).toBe('tiff')
  })

  it('tells HEIC from AVIF by the brand', () => {
    for (const brand of ['heic', 'heix', 'mif1', 'hevc'])
      expect(sniffFormat(iso(brand))).toBe('heic')
    for (const brand of ['avif', 'avis']) expect(sniffFormat(iso(brand))).toBe('avif')
  })

  it('does not call an MP4 video a picture', () => {
    expect(sniffFormat(iso('isom'))).toBeNull()
    expect(sniffFormat(iso('mp42'))).toBeNull()
  })

  it('recognises an SVG drawing, and nothing else that is plain text', () => {
    expect(sniffFormat(bytes(...text('<svg xmlns="http://www')))).toBe('svg')
    expect(sniffFormat(bytes(...text('hello there, this is a note')))).toBeNull()
  })

  it('copes with empty and tiny input', () => {
    expect(sniffFormat(bytes())).toBeNull()
    expect(sniffFormat(bytes(1, 2))).toBeNull()
    expect(sniffFormat(null)).toBeNull()
  })
})

describe('unreadableMessage', () => {
  it('says what to do for a HEIC that could not be opened', () => {
    expect(unreadableMessage('heic')).toMatch(/Photos/)
    expect(unreadableMessage('heic', { heicTried: true })).toMatch(/JPEG/)
    expect(unreadableMessage('heic', { heicTried: true, offline: true })).toMatch(/offline/)
  })

  it('names the format it cannot open', () => {
    expect(unreadableMessage('tiff')).toMatch(/TIFF/)
    expect(unreadableMessage('avif')).toMatch(/AVIF/)
  })

  it('has a plain fallback for anything else', () => {
    expect(unreadableMessage(null)).toMatch(/does not look like a photo/)
    expect(unreadableMessage('jpeg')).toMatch(/does not look like a photo/)
  })
})

describe('photoAccept', () => {
  it('lets an iPhone convert HEIC itself', () => {
    expect(photoAccept('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)')).toBe('image/*')
  })
  it('lists HEIC and AVIF for other devices', () => {
    const accept = photoAccept('Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120')
    expect(accept).toContain('image/*')
    expect(accept).toContain('.heic')
    expect(accept).toContain('.avif')
  })
})
