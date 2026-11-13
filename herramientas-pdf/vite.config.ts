import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import { prerenderPlugin } from './scripts/prerender';

// BASE_PATH permite publicar en una subcarpeta (p. ej. GitHub Pages: /pdf-libre/)
const base = process.env.BASE_PATH ?? '/';

export default defineConfig({
  base,
  plugins: [
    react(),
    prerenderPlugin(),
    VitePWA({
      registerType: 'prompt',
      injectRegister: false,
      includeAssets: ['icons/icon.svg', 'icons/apple-touch-icon.png'],
      manifest: {
        name: 'PDF Libre: herramientas PDF privadas',
        short_name: 'PDF Libre',
        description: 'Une, divide, comprime y convierte PDF en tu dispositivo. Tus archivos nunca salen de tu dispositivo.',
        lang: 'es',
        start_url: base,
        scope: base,
        display: 'standalone',
        background_color: '#ffffff',
        theme_color: '#1d5cf1',
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icons/maskable-192.png', sizes: '192x192', type: 'image/png', purpose: 'maskable' },
          { src: 'icons/maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        // Todo el código (incluidas las herramientas cargadas bajo demanda) queda disponible sin conexión
        globPatterns: ['**/*.{js,mjs,css,html,svg,png,ico,woff,woff2,pfb,ttf,wasm}'],
        globIgnores: ['**/pdfjs/cmaps/**', '**/tesseract/**', '**/*.woff', '**/*-cyrillic*', '**/*-vietnamese*', '**/*-greek*'],
        maximumFileSizeToCacheInBytes: 10 * 1024 * 1024,
        navigateFallback: 'index.html',
        navigateFallbackDenylist: [/\/sitemap\.xml$/, /\/robots\.txt$/],
        runtimeCaching: [
          {
            // Motor e idiomas del OCR (~13 MB): se guardan la primera vez que se usa el OCR
            urlPattern: ({ url }) => url.pathname.includes('/tesseract/'),
            handler: 'CacheFirst',
            options: { cacheName: 'ocr-engine', expiration: { maxEntries: 20 } },
          },
          {
            // Mapas de caracteres para PDF en chino/japonés/coreano: se guardan al primer uso
            urlPattern: ({ url }) => url.pathname.includes('/pdfjs/cmaps/'),
            handler: 'CacheFirst',
            options: { cacheName: 'pdfjs-cmaps', expiration: { maxEntries: 200 } },
          },
        ],
      },
    }),
  ],
  worker: { format: 'es' },
  build: {
    target: ['es2020', 'safari15', 'firefox102', 'chrome100'],
    chunkSizeWarningLimit: 2000,
  },
});
