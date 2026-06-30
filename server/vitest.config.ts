import path from 'node:path';
import { defineConfig } from 'vitest/config';
import { nxViteTsPaths } from '@nx/vite/plugins/nx-tsconfig-paths.plugin';

const gameCoreSrc = path.resolve(__dirname, '../libs/game-core/src');

export default defineConfig({
  root: __dirname,
  plugins: [nxViteTsPaths()],
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
  esbuild: {
    tsconfigRaw: {
      compilerOptions: {
        experimentalDecorators: true,
        emitDecoratorMetadata: true,
        useDefineForClassFields: false,
      },
    },
  },
  test: {
    globals: true,
    environment: 'node',
    passWithNoTests: true,
    include: ['src/**/*.spec.ts'],
    testTimeout: 30000,
    hookTimeout: 120_000,
    // Room-integration tests drive TownRoom.simulate() manually and
    // synchronously (see the `tick()`/`deliver()` helpers), so the background
    // simulation interval is disabled here. This removes wall-clock tick sleeps
    // and the transport/tick races they caused. Production still ticks at 50 ms.
    env: {
      NJ_AUTOSIM: '0',
    },
    // TownRoom.spec.ts shares one Colyseus boot; parallel cases race interact/quest delivery.
    sequence: {
      concurrent: false,
    },
    // Colyseus room teardown can race the next createRoom; one retry keeps the gate honest.
    retry: 1,
    fileParallelism: false,
  },
});
