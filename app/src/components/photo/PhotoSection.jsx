import { useRef } from 'react'
import { FILTERS } from '../../lib/photoFilters'
import { photoAccept } from '../../lib/photoFormat'
import { useObjectUrl } from './useMomentPhoto'
import './photo.css'

/**
 * Today's photo. Two ways in: "Take a photo" opens the camera, "Choose from your photos" opens the
 * photo library. One photo, or a photo-booth film strip of 3 or 4 (the camera adds a frame at a
 * time, the library can give several at once). Then a filter row and a strength slider, with the
 * result shown live.
 *
 * `photo` is usePhoto(); `saved` is the postcard's stored photo row (or null), shown until you pick
 * another, with a way to change its look while the postcard is not sealed.
 *  - onRemoveSaved: take the stored photo away
 */
export default function PhotoSection({ photo, saved, onRemoveSaved }) {
  const camera = useRef(null)
  const library = useRef(null)
  const savedUrl = useObjectUrl(saved?.thumb ?? null)
  const frames = photo.frames
  const strip = photo.mode === 'strip'
  // the library also lists HEIC and AVIF where the device does not convert them itself
  const accept = photoAccept()

  const chooseButtons = (label) => (
    <div className="photo__ways">
      <button className="photo__pick" disabled={photo.busy} onClick={() => camera.current?.click()}>
        Take a photo
      </button>
      <button
        className="photo__pick"
        disabled={photo.busy}
        onClick={() => library.current?.click()}
      >
        {label}
      </button>
    </div>
  )

  return (
    <section className="photo" aria-label="Photo">
      <h2>Photo</h2>

      {!photo.has && saved && (
        <>
          <img className="photo__preview" src={savedUrl} alt="Your photo for today" />
          <p className="photo__hint">
            Saved with a {saved.filter === 'none' ? 'plain' : saved.filter} look.
          </p>
          <div className="photo__row">
            {saved.sources?.length > 0 && (
              <button disabled={photo.busy} onClick={() => photo.loadSaved(saved)}>
                Change the look
              </button>
            )}
            <button onClick={() => library.current?.click()}>Replace</button>
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
              Film strip ({frames})
            </button>
          </div>
          {photo.busy ? (
            <p className="photo__hint">Opening…</p>
          ) : (
            chooseButtons('Choose from your photos')
          )}
          <p className="photo__hint">
            {strip
              ? photo.waiting > 0
                ? `${photo.waiting} of ${frames} photos so far. Add ${frames - photo.waiting} more.`
                : `Add ${frames} photos, one at a time or together.`
              : 'It stays on your phone and peeks out from behind your stamp.'}
          </p>
        </>
      )}

      {photo.has && (
        <>
          {photo.preview && (
            <img className="photo__preview" src={photo.preview} alt="Your photo with the filter" />
          )}
          <div className="photo__filters" role="group" aria-label="Filter">
            {FILTERS.map((f) => (
              <button
                key={f.id}
                className={photo.filter === f.id ? 'on' : ''}
                aria-pressed={photo.filter === f.id}
                onClick={() => photo.setFilter(f.id)}
              >
                {photo.thumbs?.[f.id] ? (
                  <img src={photo.thumbs[f.id]} alt="" draggable={false} />
                ) : (
                  <i aria-hidden="true" />
                )}
                <span>{f.label}</span>
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
            <button onClick={() => library.current?.click()}>Change photo</button>
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
      {/* the camera: one picture at a time. The library: several for a strip. */}
      <input
        ref={camera}
        type="file"
        accept="image/*"
        capture="environment"
        hidden
        aria-label="Take a photo with the camera"
        onChange={(e) => {
          photo.pick(e.target.files)
          e.target.value = ''
        }}
      />
      <input
        ref={library}
        type="file"
        accept={accept}
        multiple={strip}
        hidden
        aria-label="Choose photos from your library"
        onChange={(e) => {
          photo.pick(e.target.files)
          e.target.value = ''
        }}
      />
    </section>
  )
}
