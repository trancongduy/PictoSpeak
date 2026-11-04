import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

const cdnCache = (pattern: RegExp, cacheName: string) => ({
  urlPattern: pattern,
  handler: 'CacheFirst' as const,
  options: {
    cacheName,
    expiration: { maxEntries: 40, maxAgeSeconds: 60 * 60 * 24 * 365 },
    cacheableResponse: { statuses: [0, 200] },
  },
});

export default defineConfig({
  base: process.env.BASE_PATH ?? '/',
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'icons/*.png'],
      manifest: {
        name: 'PictoSpeak – Ảnh thành giọng nói',
        short_name: 'PictoSpeak',
        description: 'Chụp ảnh chữ tiếng Anh và nghe đọc to, luyện nghe nói kiểu IELTS',
        lang: 'vi',
        start_url: '.',
        scope: '.',
        display: 'standalone',
        orientation: 'portrait',
        background_color: '#0f172a',
        theme_color: '#2563eb',
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png}'],
        maximumFileSizeToCacheInBytes: 6 * 1024 * 1024,
        runtimeCaching: [
          cdnCache(/^https:\/\/cdn\.jsdelivr\.net\/.*/i, 'ocr-cdn'),
          cdnCache(/^https:\/\/unpkg\.com\/.*/i, 'ocr-unpkg'),
          cdnCache(/^https:\/\/tessdata\.projectnaptha\.com\/.*/i, 'ocr-lang'),
        ],
      },
    }),
  ],
});
