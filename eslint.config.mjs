import nx from '@nx/eslint-plugin';

export default [
  ...nx.configs['flat/base'],
  ...nx.configs['flat/typescript'],
  {
      "ignores": [
        "**/dist",
        "**/node_modules",
        "**/.nx",
        "**/vitest.config.*.timestamp*"
      ]
  },
];
