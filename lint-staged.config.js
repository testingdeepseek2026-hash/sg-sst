// lint-staged configuration
export default {
  '*.{ts,tsx,js,jsx}': ['eslint --fix --max-warnings 0 --no-warn-ignored', 'prettier --write'],
  '*.{json,md,yml,yaml}': ['prettier --write'],
};
