export default {
  define: {},
  plugins: [
    (await import('@vitejs/plugin-react')).default(),
    (await import('vite-plugin-pwa')).VitePWA({
      registerType: 'autoUpdate',
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg}'],
        navigateFallback: '/index.html',
        navigateFallbackDenylist: [/^\/api\/.*/, /^\/uploads\/.*/],
      },
      manifest: {
        name: 'SG-SST Microempresa',
        short_name: 'SG-SST',
        description: 'Sistema de Gestion de Seguridad y Salud en el Trabajo - Colombia',
        start_url: '/',
        display: 'standalone',
        theme_color: '#0f766e',
        background_color: '#ffffff',
        lang: 'es',
        dir: 'ltr',
        icons: [
          {
            src: '/icon-192.svg',
            sizes: '192x192',
            type: 'image/svg+xml',
            purpose: 'any maskable',
          },
          {
            src: '/icon-512.svg',
            sizes: '512x512',
            type: 'image/svg+xml',
            purpose: 'any maskable',
          },
        ],
      },
    }),
  ],
  resolve: {
    alias: [
      { find: /^@\/assets/, replacement: '/src/assets' },
      { find: /^@\/components/, replacement: '/src/components' },
      { find: /^@\/pages/, replacement: '/src/pages' },
      { find: /^@\/lib/, replacement: '/src/lib' },
      { find: /^@\/hooks/, replacement: '/src/hooks' },
    ],
  },
  build: {
    outDir: '../server/dist/public',
    emptyOutDir: true,
  },
  server: {
    port: 5173,
    proxy: {
      '/api': 'http://localhost:4000',
      '/uploads': 'http://localhost:4000',
    },
  },
};
