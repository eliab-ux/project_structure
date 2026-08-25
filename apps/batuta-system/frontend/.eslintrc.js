/**
 * ESLint for the frontend.
 *
 * It exists for the same reason the backends have their own: the root config points
 * `parserOptions.project` at the ROOT tsconfig, which does not include this app's files — so typed
 * linting fails to parse every one of them. The fix belongs here, per app, next to the tsconfig that
 * actually knows this app needs `jsx` and `lib: dom`.
 *
 * `root: true` stops the root config from being merged in at all. Without it, the root's Node/Jest env
 * and its `parserOptions.project` would still apply and produce the same parse errors.
 */
module.exports = {
  root: true,
  parser: '@typescript-eslint/parser',
  parserOptions: {
    project: './tsconfig.json',
    tsconfigRootDir: __dirname,
    sourceType: 'module',
    ecmaFeatures: { jsx: true },
  },
  plugins: ['@typescript-eslint', 'prettier'],
  extends: [
    'next/core-web-vitals',
    'plugin:@typescript-eslint/recommended',
    'plugin:prettier/recommended',
  ],
  env: {
    browser: true,
    es2022: true,
  },
  ignorePatterns: ['.eslintrc.js', '.next', 'node_modules', 'next-env.d.ts', '**/*.d.ts'],
  rules: {
    '@typescript-eslint/explicit-function-return-type': 'off',
    '@typescript-eslint/explicit-module-boundary-types': 'off',
    '@typescript-eslint/no-explicit-any': 'error',
    '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
    'prettier/prettier': 'error',
    // React 17+ with the automatic JSX runtime: importing React in every file is noise.
    'react/react-in-jsx-scope': 'off',
  },
};
