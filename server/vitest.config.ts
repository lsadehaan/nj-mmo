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
  },
});
