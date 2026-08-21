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
            src: 'pwa-192x192.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'any'
          },
          {
            src: 'pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any'
          }
        ]
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,jpg,svg,woff2}']
      }
    })
  ],
  build: {
    target: 'es2020',
    minify: 'esbuild'
  }
})