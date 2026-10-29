import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, URL } from 'node:url';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

/**
 * Build for the OpenNext CMS Mount API (no iframe).
 *
 * Emits an ESM module the CMS imports and calls `mount(el, ctx)` on, plus a
 * real stylesheet the host can fetch and wrap in `@scope (#plugin-root)`. The
 * app build (`vite.config.ts`) still produces index.html so the same package
 * keeps working on an older, iframe-based CMS.
 */
/**
 * Make the stylesheet work inside the host's `@scope (#plugin-root)` wrapper.
 *
 * The CMS fetches `manifest.styles` and wraps it in `@scope (#plugin-root) {…}`,
 * which only matches elements *inside* that div. Three kinds of selector in a
 * Tailwind build therefore stop matching anything at all:
 *
 *   :root       — holds every CSS variable (--background, --card, --border…)
 *   html, body  — the page canvas: background, text colour, font smoothing
 *   html.dark X — all 136 dark-mode overrides
 *
 * Rewriting them to `:scope` fixes both worlds at once: inside `@scope` it is
 * the plugin root, and in a plain stylesheet it is the document root, which is
 * exactly what `:root`/`html` meant before.
 */
function scopeFriendlyCss() {
  return {
    name: 'crm-scope-friendly-css',
    // `post` + writeBundle: Vite emits CSS from its own plugin after ours, so
    // the file is rewritten on disk once it exists.
    enforce: 'post' as const,
    writeBundle(options: { dir?: string }) {
      const outDir = options?.dir;
      if (!outDir) return;
      const cssPath = path.join(outDir, 'style.css');
      if (!fs.existsSync(cssPath)) return;
      const rewritten = fs
        .readFileSync(cssPath, 'utf8')
        .replace(/(^|[},])html\.dark/g, '$1:scope.dark')
        .replace(/(^|[},]):root/g, '$1:scope')
        .replace(/(^|[},])html\s*\{/g, '$1:scope{')
        .replace(/(^|[},])body\s*\{/g, '$1:scope{');
      /*
       * The host mounts us into `#plugin-root`, which is
       * `absolute inset-0 overflow-auto p-4` — a scroll container that already
       * has a height. Full-viewport heights inside it produce a second
       * scrollbar and clipped content, so they become full-container heights.
       * Only the mount build is adjusted; the standalone build still runs in a
       * document of its own.
       */
      const mountOnlyOverrides = [
        ':scope{min-height:100%}',
        ':scope .min-h-screen{min-height:100%}',
        ':scope .h-screen{height:100%}',
      ].join('');

      fs.writeFileSync(cssPath, rewritten + mountOnlyOverrides, 'utf8');
    },
  };
}

export default defineConfig({
  plugins: [react(), scopeFriendlyCss()],
  /**
   * Library mode leaves `process.env.NODE_ENV` in place for the consumer to
   * define, but our consumer is a browser: without this React would look for a
   * `process` global that does not exist, and would ship its development build.
   */
  define: {
    'process.env.NODE_ENV': JSON.stringify('production'),
  },
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  // Assets resolve against /plugins/{id}/ui/admin/ at runtime.
  base: './',
  build: {
    outDir: 'dist-mount',
    emptyOutDir: true,
    // One stylesheet, so manifest.styles can name it and the host scopes it.
    cssCodeSplit: false,
    modulePreload: false,
    // Library mode does not minify by default; the dashboard loads this module
    // directly, so it should be no heavier than the iframe bundle was.
    minify: 'esbuild',
    lib: {
      entry: fileURLToPath(new URL('./src/mount.tsx', import.meta.url)),
      formats: ['es'],
      fileName: () => 'mount.js',
    },
  },
});
