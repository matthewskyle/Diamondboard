import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      // The app has no backend, so everything it needs can be precached: once
      // installed it runs with no network at all — the point of a board you use
      // on a field.
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'apple-touch-icon.png'],
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,ico}'],
        // Relative base means no fixed root URL to fall back to; the precached
        // index is the offline entry point.
        navigateFallback: 'index.html',
      },
      manifest: {
        name: 'Diamondboard',
        short_name: 'Diamondboard',
        description:
          'Interactive baseball field for teaching and learning situational baseball.',
        start_url: './',
        scope: './',
        display: 'standalone',
        background_color: '#2c483d',
        theme_color: '#2c483d',
        icons: [
          { src: 'pwa-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512.png', sizes: '512x512', type: 'image/png' },
          {
            src: 'pwa-maskable-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
    }),
  ],
  // Relative asset paths keep the build hostable from any subpath.
  base: './',
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
})
