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
      includeAssets: ['icon.svg'],
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
        icons: [{ src: 'icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' }],
      },
      workbox: { globPatterns: ['**/*.{js,css,html,svg,png,woff2,json}'] },
    }),
  ],
})
