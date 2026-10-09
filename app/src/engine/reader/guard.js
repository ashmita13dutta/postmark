/**
 * A fetch that never mistakes a web page for a model file.
 *
 * Some hosts (and the dev server) answer a request for a file that is not there with their home page
 * and a 200 "OK". The reader would take that page for the model, save it in the browser's cache, and
 * then fail on every launch until the cache was cleared. So an HTML answer is turned into a 404:
 * "not found", which is what it really is, and nothing is cached.
 *
 * The reader only ever asks for model files, the tokenizer and the runtime, none of which are HTML.
 */
export function makeGuardedFetch(realFetch) {
  return async function guardedFetch(input, init) {
    const response = await realFetch(input, init)
    const type = response.headers.get('content-type') ?? ''
    if (response.ok && type.toLowerCase().includes('text/html')) {
      return new Response(null, { status: 404, statusText: 'Not found (a web page came back)' })
    }
    return response
  }
}
