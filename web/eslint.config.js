/** @type {import('eslint').Linter.FlatConfig[]} */
import baseConfig from '../eslint.config.js';

export default [
  ...baseConfig,
  {
    files: ['src/**/*.{ts,tsx}'],
    languageOptions: {
      globals: {
        browser: true,
        es2022: true,
      },
    },
    settings: {
      react: {
        version: '18.3',
      },
    },
    rules: {
      // Web-specific rules
      'react-refresh/only-export-components': [
        'warn',
        { allowConstantExport: true },
      ],
      '@typescript-eslint/no-floating-promises': 'warn',
      '@typescript-eslint/no-misused-promises': 'warn',
      'no-console': ['warn', { allow: ['warn', 'error'] }],
    },
  },
  {
    files: ['src/**/*.test.{ts,tsx}', 'src/__tests__/**/*.{ts,tsx}'],
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
        render: true,
        screen: true,
        fireEvent: true,
        waitFor: true,
        act: true,
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