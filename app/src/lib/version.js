/**
 * Which build is running. vite.config.js stamps the short git commit and the build time into the
 * app, so the You screen can show them and you can tell whether the phone has the latest version.
 */
/* global __APP_COMMIT__, __APP_BUILT__ */
export const BUILD = {
  commit: typeof __APP_COMMIT__ === 'string' ? __APP_COMMIT__ : 'dev',
  builtAt: typeof __APP_BUILT__ === 'string' ? __APP_BUILT__ : '',
}

/** "Version eb8b410 · 9 Oct, 18:28". Without a usable build time it is just the commit. */
export function versionLabel(build = BUILD, locale) {
  const built = new Date(build.builtAt)
  if (!build.builtAt || Number.isNaN(built.getTime())) return `Version ${build.commit}`
  const when = built.toLocaleString(locale, {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  })
  return `Version ${build.commit} · ${when}`
}
