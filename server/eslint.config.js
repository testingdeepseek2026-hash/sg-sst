/** @type {import('eslint').Linter.FlatConfig[]} */
import baseConfig from '../eslint.config.js';

export default [
  ...baseConfig,
  {
    files: ['src/**/*.ts'],
    languageOptions: {
      globals: {
        node: true,
        es2022: true,
      },
    },
    rules: {
      // Server-specific rules
      '@typescript-eslint/no-floating-promises': 'error',
      '@typescript-eslint/no-misused-promises': 'error',
      'no-console': ['warn', { allow: ['warn', 'error', 'log', 'info'] }],
    },
  },
  {
    files: ['src/__tests__/**/*.ts', 'src/**/*.test.ts'],
    languageOptions: {
      globals: {
        describe: true,
        it: true,
        expect: true,
        vi: true,
        beforeEach: true,
        afterEach: true,
        beforeAll: true,
        afterAll: true,
      },
    },
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
      'no-console': 'off',
      '@typescript-eslint/no-floating-promises': 'off',
      '@typescript-eslint/no-misused-promises': 'off',
    },
  },
];