import { useRef } from 'react'
import { FILTERS } from '../../lib/photoFilters'
import { useObjectUrl } from './useMomentPhoto'
import './photo.css'

/**
 * Today's photo: one photo or a photo-booth film strip, a filter row and an intensity slider, with
 * the result shown live. `photo` is usePhoto(); `saved` is the postcard's stored photo row (or null),
 * shown until you pick another. A sealed postcard shows nothing here.
 *  - onRemoveSaved: take the stored photo away
 */
export default function PhotoSection({ photo, saved, onRemoveSaved }) {
  const input = useRef(null)
  const savedUrl = useObjectUrl(saved?.thumb ?? null)
  const frames = photo.frames

  return (
    <section className="photo" aria-label="Photo">
      <h2>Photo</h2>

      {!photo.has && saved && (
        <>
          <img className="photo__preview" src={savedUrl} alt="Your photo for today" />
          <p className="photo__hint">
            Saved with a {saved.filter === 'none' ? 'plain' : saved.filter} look. Pick another to
            replace it.
          </p>
          <div className="photo__row">
            <button onClick={() => input.current?.click()}>Replace</button>
            <button className="photo__remove" onClick={onRemoveSaved}>
              Remove
            </button>
          </div>
        </>
      )}

      {!photo.has && !saved && (
        <>
          <div className="photo__row" role="group" aria-label="One photo or a film strip">
            <button
              className={photo.mode === 'single' ? 'on' : ''}
              onClick={() => photo.setMode('single')}
            >
              One photo
            </button>
            <button
              className={photo.mode === 'strip' ? 'on' : ''}
              onClick={() => photo.setMode('strip')}
            >
              Film strip ({frames > 1 ? frames : 3})
            </button>
          </div>
          <button
            className="photo__pick"
            style={{ marginTop: 10 }}
            disabled={photo.busy}
            onClick={() => input.current?.click()}
          >
            {photo.busy
              ? 'Opening…'
              : photo.mode === 'strip'
                ? `Pick ${frames} photos`
                : 'Add a photo'}
          </button>
          <p className="photo__hint">
            It stays on your phone and peeks out from behind your stamp.
          </p>
        </>
      )}

      {photo.has && (
        <>
          {photo.preview && (
            <img className="photo__preview" src={photo.preview} alt="Your photo with the filter" />
          )}
          <div className="photo__row" role="group" aria-label="Filter">
            {FILTERS.map((f) => (
              <button
                key={f.id}
                className={photo.filter === f.id ? 'on' : ''}
                aria-pressed={photo.filter === f.id}
                onClick={() => photo.setFilter(f.id)}
              >
                {f.label}
              </button>
            ))}
          </div>
          {photo.filter !== 'none' && (
            <label className="photo__slider">
              Strength
              <input
                type="range"
                min="0"
                max="100"
                value={Math.round(photo.intensity * 100)}
                onChange={(e) => photo.setIntensity(Number(e.target.value) / 100)}
                aria-label="Filter strength"
              />
              <span>{Math.round(photo.intensity * 100)}%</span>
            </label>
          )}
          <div className="photo__row">
            <button onClick={() => input.current?.click()}>Change</button>
            <button className="photo__remove" onClick={photo.clear}>
              Remove
            </button>
          </div>
        </>
      )}

      {photo.error && (
        <p className="photo__error" role="alert">
          {photo.error}
        </p>
      )}
      <input
        ref={input}
        type="file"
        accept="image/*"
        multiple={photo.mode === 'strip'}
        hidden
        aria-label="Choose a photo"
        onChange={(e) => {
          photo.pick(e.target.files)
          e.target.value = ''
        }}
      />
    </section>
  )
}
