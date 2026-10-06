import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// BASE_PATH is set by CI for GitHub Pages project sites (e.g. /Postmark/). Cloudflare Pages uses '/'.
const base = process.env.BASE_PATH || '/'

export default defineConfig({
  base,
  plugins: [
    react(),
    VitePWA({
      registerType: 'prompt', // "New version ready" flow comes later
      includeAssets: ['icon.svg', 'apple-touch-icon.png', 'favicon-64.png'],
      manifest: {
        name: 'Postmark',
        short_name: 'Postmark',
        description: 'Every day becomes a postage stamp.',
        theme_color: '#F4EFE6',
        background_color: '#F4EFE6',
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
        globIgnores: ['splash/**', '**/noto-color-emoji-*', 'og-card.png', 'icon-1024.png'],
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
