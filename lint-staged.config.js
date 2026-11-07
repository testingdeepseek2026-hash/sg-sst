# lint-staged configuration
export default {
  '*.{ts,tsx,js,jsx}': [
    'eslint --fix --max-warnings 0',
    'prettier --write',
  ],
  '*.{json,md,yml,yaml}': [
    'prettier --write',
  ],
  '*.{ts,tsx}': [
    'eslint --fix --max-warnings 0',
    'prettier --write',
    'typecheck',
  ],
};