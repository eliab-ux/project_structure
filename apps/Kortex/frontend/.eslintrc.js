/**
 * ESLint do frontend.
 *
 * Existe pelo mesmo motivo dos backends terem o seu: a config da raiz aponta
 * `parserOptions.project` para o tsconfig RAIZ, que não inclui os arquivos deste app — e aí o lint
 * tipado falha ao parsear todos eles. A correção fica aqui, por app, ao lado do tsconfig que
 * realmente sabe que este app precisa de `jsx` e `lib: dom`.
 *
 * `root: true` impede a config da raiz de ser mesclada. Sem isso, o env Node/Jest e o
 * `parserOptions.project` da raiz continuariam valendo e produziriam os mesmos erros de parse.
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
    // React 17+ com o JSX runtime automático: importar React em todo arquivo é ruído.
    'react/react-in-jsx-scope': 'off',
  },
};
