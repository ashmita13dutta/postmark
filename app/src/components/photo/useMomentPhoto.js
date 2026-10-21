import { useLiveQuery } from 'dexie-react-hooks'
import { useEffect, useMemo } from 'react'
import { queries } from '../../db/queries'

/** A picture URL for a Blob, made once and let go of when the Blob changes or the screen goes. */
export function useObjectUrl(blob) {
  const url = useMemo(() => (blob ? URL.createObjectURL(blob) : null), [blob])
  useEffect(
    () => () => {
      if (url) URL.revokeObjectURL(url)
    },
    [url],
  )
  return url
}

/**
 * A postcard's photo: { url, kind, filter } or null (still loading, or there is none). `which` is
 * 'thumb' (small: stamps, calendar) or 'blob' (the full picture). Updates when the photo changes.
 */
export function useMomentPhoto(momentId, which = 'thumb') {
  const media = useLiveQuery(
    () => (momentId ? queries.mediaForMoment(momentId) : []),
    [momentId],
  )?.[0]
  const url = useObjectUrl(media?.[which] ?? media?.blob ?? null)
  return media && url ? { url, kind: media.kind, filter: media.filter } : null
}
