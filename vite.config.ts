import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react(),
    {
      name: 'plugin-iframe-html',
      transformIndexHtml(html) {
        // CMS plugin iframes often lack CORS headers; Vite's crossorigin breaks CSS apply.
        return html.replace(/\s+crossorigin(?:="[^"]*")?/g, '');
      },
    },
  ],
  server: {
    port: 3000,
    proxy: {
      '/api': {
        target: 'http://localhost:3011',
        changeOrigin: true,
        secure: false,
      },
    },
  },
  base: './',
  build: {
    cssCodeSplit: true,
    modulePreload: false,
  },
});
