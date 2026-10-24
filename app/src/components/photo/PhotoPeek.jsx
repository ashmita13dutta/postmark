import { motion } from 'framer-motion'
import { peekGeometry, peekX } from '../../lib/photo'
import { useMomentPhoto } from './useMomentPhoto'
import './photo.css'

/**
 * A postcard's photo tucked behind its stamp, fanned out so its outer end leans away from the stamp,
 * showing about a third of itself beside the stamp (spec section 10). Put it as the FIRST child of a box that is exactly as wide as
 * the stamp (`position: relative`) and the stamp paints over it. Renders nothing without a photo.
 *  - momentId, seed: which postcard, and what steadies its tilt (the day)
 *  - slide:          { delay } to slide out from behind the stamp (Reveal); omit to just sit there
 *  - photo:          an already-loaded photo { url, kind }, or null for none (the Calendar loads a
 *                    month's at once); leave it out and the postcard's own photo is read
 *  - scale:          makes the photo narrower or wider than usual (the postcard back uses less)
 *  - className:      extra classes, e.g. a smaller look in the Calendar
 */
export default function PhotoPeek({
  momentId,
  seed,
  back = false,
  slide,
  photo: given,
  scale = 1,
  className = '',
}) {
  const own = useMomentPhoto(given === undefined ? momentId : null)
  const photo = given === undefined ? own : given
  if (!photo) return null
  const g = peekGeometry(seed, back)
  // a film strip is tall and narrow, so it peeks out smaller
  const width = (photo.kind === 'strip' ? g.width * 0.5 : g.width) * scale
  const x = peekX(g, width)
  const style = {
    left: `${x * 100}%`,
    top: `${(0.1 + g.y) * 100}%`,
    width: `${width * 100}%`,
    // it fans out from the edge hidden behind the stamp, so the part that shows leans outward
    transformOrigin: `${g.originX * 100}% 60%`,
  }
  const turned = { rotate: g.rotate }
  return (
    <motion.img
      className={`${photo.kind === 'strip' ? 'peek peek--strip' : 'peek'} ${className}`.trim()}
      src={photo.url}
      alt=""
      draggable={false}
      style={style}
      initial={slide ? { ...turned, x: `${-g.side * 55}%`, opacity: 0 } : turned}
      animate={{ ...turned, x: 0, opacity: 1 }}
      transition={
        slide
          ? { type: 'spring', stiffness: 160, damping: 16, delay: slide.delay }
          : { duration: 0 }
      }
    />
  )
}
