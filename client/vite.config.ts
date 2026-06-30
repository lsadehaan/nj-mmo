/// <reference types='vitest' />
import { defineConfig } from 'vite';
import { nxViteTsPaths } from '@nx/vite/plugins/nx-tsconfig-paths.plugin';
import type { Plugin } from 'vite';
import * as net from 'node:net';
import * as http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Forwards Colyseus room WebSocket upgrades to the game server.
// Colyseus room WS paths look like /{processId}/{roomId} — short alphanumeric
// IDs. This lets us use a single ngrok tunnel with no cross-origin issues.
function colyseusWsProxy(): Plugin {
  // Matches /{processId}/{roomId}?... — e.g. /F3L72UD0B/puK66jR-J?sessionId=...
  const COLYSEUS_PATH = /^\/[A-Za-z0-9]{5,}\/[A-Za-z0-9_-]{5,}/;
  return {
    name: 'colyseus-ws-proxy',
    configureServer(server) {
      if (!process.env.VITE_TUNNEL) return;
      server.httpServer?.on('upgrade', (req: http.IncomingMessage, socket: net.Socket, head: Buffer) => {
        if (!COLYSEUS_PATH.test(req.url ?? '')) return;
        const target = net.createConnection(2567, '127.0.0.1', () => {
          const headers = Object.entries(req.headers)
            .map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(', ') : v}`)
            .join('\r\n');
          target.write(`GET ${req.url} HTTP/1.1\r\n${headers}\r\n\r\n`);
          if (head.length > 0) target.write(head);
          socket.pipe(target);
          target.pipe(socket);
        });
        target.on('error', () => socket.destroy());
        socket.on('error', () => target.destroy());
      });
    },
  };
}

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
  plugins: [nxViteTsPaths(), colyseusWsProxy()],
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
