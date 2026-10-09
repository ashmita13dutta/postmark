import { execSync } from 'node:child_process'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// BASE_PATH is set by CI for GitHub Pages project sites (e.g. /Postmark/). Cloudflare Pages uses '/'.
const base = process.env.BASE_PATH || '/'

// short git commit of this build, shown on the You screen so you can tell which version a phone has
function commit() {
  try {
    return execSync('git rev-parse --short HEAD', { stdio: ['ignore', 'pipe', 'ignore'] })
      .toString()
      .trim()
  } catch {
    return 'dev'
  }
}

export default defineConfig({
  base,
  resolve: {
    // The note reader runs a language model in a web worker. This picks the build of the model
    // runtime that expects us to hand it its WebAssembly file (see src/engine/reader/reader.worker.js), so
    // the app hosts it itself instead of fetching a bigger copy from a public CDN.
    conditions: ['onnxruntime-web-use-extern-wasm'],
  },
  worker: { format: 'es' },
  define: {
    __APP_COMMIT__: JSON.stringify(commit()),
    __APP_BUILT__: JSON.stringify(new Date().toISOString()),
  },
  plugins: [
    react(),
    VitePWA({
      registerType: 'prompt', // "New version ready" flow comes later
      includeAssets: ['icon.svg', 'apple-touch-icon.png', 'favicon-64.png'],
      manifest: {
        name: 'Postmark',
        short_name: 'Postmark',
        description: 'Every day becomes a postage stamp.',
        theme_color: '#EFE9DC',
        background_color: '#EFE9DC',
        display: 'standalone',
        orientation: 'portrait',
        start_url: base,
        scope: base,
        shortcuts: [
          {
            name: 'Calendar',
            url: `${base}#/calendar`,
            icons: [{ src: 'icon-192.png', sizes: '192x192' }],
          },
          {
            name: 'Mailbox',
            url: `${base}#/mailbox`,
            icons: [{ src: 'icon-192.png', sizes: '192x192' }],
          },
        ],
        categories: ['lifestyle', 'productivity'],
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          {
            src: 'icon-512-maskable.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
          { src: 'icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,woff2,json}'],
        // launch screens and the share card are only fetched by the phone / link previewers, no need offline
        globIgnores: [
          'splash/**',
          '**/noto-color-emoji-*',
          'og-card.png',
          'icon-1024.png',
          // the reader's model (about 34 MB) is only fetched when you turn smart reading on, and the
          // reader caches it itself, so it must not be part of the install
          'models/**',
        ],
        // emoji font chunks are big (up to ~1 MB each), so cache each one the first time it is shown
        runtimeCaching: [
          {
            urlPattern: /noto-color-emoji-.*\.woff2$/,
            handler: 'CacheFirst',
            options: { cacheName: 'emoji-font', expiration: { maxEntries: 20 } },
          },
        ],
      },
    }),
  ],
})
