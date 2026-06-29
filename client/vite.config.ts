/// <reference types='vitest' />
import { defineConfig } from 'vite';
import { nxViteTsPaths } from '@nx/vite/plugins/nx-tsconfig-paths.plugin';

import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('.', import.meta.url));
const gameCoreSrc = path.resolve(root, '../libs/game-core/src');

export default defineConfig(() => ({
  root,
  cacheDir: '../node_modules/.vite/client',
  define: {
    'import.meta.env.VITE_NJ_E2E': JSON.stringify(process.env['VITE_NJ_E2E'] ?? ''),
  },
  resolve: {
    alias: [
      {
        find: '@nj/game-core',
        replacement: path.join(gameCoreSrc, 'index.ts'),
      },
      {
        find: /^@nj\/game-core\/(.*)$/,
        replacement: `${gameCoreSrc}/$1`,
      },
    ],
  },
  server: {
    port: 4200,
    host: 'localhost',
    fs: {
      allow: ['..'],
    },
  },
  preview: {
    port: 4300,
    host: 'localhost',
  },
  plugins: [nxViteTsPaths()],
  build: {
    outDir: '../dist/client',
    emptyOutDir: true,
    reportCompressedSize: true,
    rollupOptions: {
      input: {
        main: path.join(root, 'index.html'),
        characterLab: path.join(root, 'character-lab.html'),
        vfxLab: path.join(root, 'vfx-lab.html'),
        iconLab: path.join(root, 'icon-lab.html'),
        environmentLab: path.join(root, 'environment-lab.html'),
      },
    },
    commonjsOptions: {
      transformMixedEsModules: true,
    },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    passWithNoTests: true,
    include: ['src/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}'],
    reporters: ['default'],
    env: {
      VITE_NJ_E2E: 'true',
    },
    coverage: {
      reportsDirectory: '../coverage/client',
      provider: 'v8',
    },
  },
}));
