import { defineConfig } from 'vite'
import preact from '@preact/preset-vite'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  base: '/beefcake/',
  plugins: [
    preact(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.ico', 'apple-touch-icon.png'],
      manifest: {
        name: 'Beefcake',
        short_name: 'Beefcake',
        description: 'Träningslogg för styrketräning',
        theme_color: '#1b2634',
        background_color: '#1b2634',
        display: 'standalone',
        orientation: 'portrait-primary',
        scope: '/beefcake/',
        start_url: '/beefcake/',
        icons: [
          {
            src: 'pwa-192x192.svg',
            sizes: '192x192',
            type: 'image/svg+xml',
            purpose: 'any maskable'
          },
          {
            src: 'pwa-512x512.svg',
            sizes: '512x512',
            type: 'image/svg+xml',
            purpose: 'any maskable'
          }
        ]
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}']
      }
    })
  ],
  build: {
    target: 'es2020',
    minify: 'esbuild'
  }
})