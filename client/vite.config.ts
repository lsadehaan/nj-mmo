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
    host: process.env.VITE_TUNNEL ? '0.0.0.0' : 'localhost',
    allowedHosts: process.env.VITE_TUNNEL ? true : undefined,
    proxy: process.env.VITE_TUNNEL
      ? {
          '/matchmake': { target: 'http://localhost:2567', changeOrigin: true },
          '/api': { target: 'http://localhost:2567', changeOrigin: true },
          // Colyseus room WebSocket path: /{processId}/{roomId}?sessionId=...
          // Colyseus nanoid IDs are exactly 9 chars: alphanumeric + _ and -.
          // Static asset paths (/models, /audio, /icons) are shorter and never contain
          // a second 9-char segment, so they won't match.
          // Vite proxy keys starting with ^ are treated as regex patterns.
          '^/[A-Za-z0-9_-]{9}/[A-Za-z0-9_-]{9}': {
            target: 'ws://localhost:2567',
            ws: true,
            changeOrigin: true,
          },
        }
      : undefined,
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
    coverage: {
      reportsDirectory: '../coverage/client',
      provider: 'v8',
    },
  },
}));
