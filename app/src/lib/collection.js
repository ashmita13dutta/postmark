/**
 * "Your stickers" on You, pure so it can be tested: what is in each sticker pack, how often you have
 * used it, and which delivered months featured it (lib/rewards.js). Nothing is locked: every pack is
 * always open, this only shows the collection and how you use it.
 *
 * `packs` is PACKS from data/stickers.js; `decorations` are the stickers put on postcards
 * ({ momentId, stickerId }); `rewards` are earned rewards (kind 'month-pack' has packId, monthKey, name).
 */

/**
 * @returns {{
 *   packs: { id, label, kind, count, used, months: { monthKey, name }[] }[],
 *   stickers: number, used: number, postcards: number,
 *   top: { id, label, packLabel, count } | null
 * }}
 *  `used` on a pack is how many stickers from it sit on postcards; `top` is the single sticker you
 *  have used most (the earliest-listed one on a tie).
 */
export function collectionStats(packs, decorations, rewards = []) {
  const owner = new Map() // sticker id -> pack id
  for (const pack of packs) for (const item of pack.items) owner.set(item.id, pack.id)

  const used = new Map() // pack id -> uses
  const perSticker = new Map() // sticker id -> uses
  const postcards = new Set()
  let total = 0
  for (const d of decorations) {
    const pack = owner.get(d.stickerId)
    if (!pack) continue // from a pack that has since been removed
    used.set(pack, (used.get(pack) ?? 0) + 1)
    perSticker.set(d.stickerId, (perSticker.get(d.stickerId) ?? 0) + 1)
    postcards.add(d.momentId)
    total += 1
  }

  const months = new Map()
  for (const r of rewards) {
    if (r.kind !== 'month-pack' || !r.packId) continue
    if (!months.has(r.packId)) months.set(r.packId, [])
    months.get(r.packId).push({ monthKey: r.monthKey, name: r.name })
  }

  let top = null
  for (const pack of packs)
    for (const item of pack.items) {
      const count = perSticker.get(item.id) ?? 0
      if (count > (top?.count ?? 0))
        top = { id: item.id, label: item.label, packLabel: pack.label, count }
    }

  return {
    packs: packs.map((pack) => ({
      id: pack.id,
      label: pack.label,
      kind: pack.kind,
      count: pack.items.length,
      used: used.get(pack.id) ?? 0,
      months: (months.get(pack.id) ?? []).sort((a, b) => (a.monthKey < b.monthKey ? 1 : -1)),
    })),
    stickers: packs.reduce((n, p) => n + p.items.length, 0),
    used: total,
    postcards: postcards.size,
    top,
  }
}
