/// <reference types="vitest" />
import fs from 'node:fs';
import path from 'node:path';
import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';

/** Emits sw.js with a precache list of every built file, so the site works offline after the first visit. */
function serviceWorker(): Plugin {
  return {
    name: 'wtsf-service-worker',
    apply: 'build',
    generateBundle(_, bundle) {
      const publicDir = path.resolve(__dirname, 'public');
      const publicFiles = fs
        .readdirSync(publicDir, { recursive: true, withFileTypes: true })
        .filter((d) => d.isFile())
        .map((d) => path.relative(publicDir, path.join(d.parentPath ?? (d as unknown as { path: string }).path, d.name)).split(path.sep).join('/'))
        // Dotfiles such as .nojekyll are not served by Pages; a 404 would abort the whole precache.
        .filter((f) => !f.split('/').some((seg) => seg.startsWith('.')));
      const files = ['./', ...Object.keys(bundle).map((f) => `./${f}`), ...publicFiles.map((f) => `./${f}`)];
      const version = Date.now().toString(36);
      const src = fs
        .readFileSync(path.resolve(__dirname, 'sw-template.js'), 'utf8')
        .replace('__VERSION__', version)
        .replace('__PRECACHE__', JSON.stringify([...new Set(files)], null, 2));
      this.emitFile({ type: 'asset', fileName: 'sw.js', source: src });
    },
  };
}

// GitHub Pages serves the site from https://<user>.github.io/wt-sight-forge/
// (`vite preview` must use the same base as the build; only the dev server runs at "/".)
export default defineConfig(({ command, isPreview }) => ({
  base: command === 'serve' && !isPreview ? '/' : '/wt-sight-forge/',
  plugins: [react(), serviceWorker()],
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
  },
}));
