// Herda tudo da config da raiz do monorepo; só aponta o lint tipado para um TSConfig que cobre as
// árvores de src E de test. O `tsconfig.json` da raiz não inclui os arquivos deste app, e o deste
// app exclui os spec — sem isto, todo arquivo falha o parse ("TSConfig does not include this
// file"). O `tsconfig.spec.json` inclui também os configs da raiz do app (jest, mikro-orm).
module.exports = {
  parserOptions: {
    project: ['./tsconfig.spec.json'],
    tsconfigRootDir: __dirname,
  },
  ignorePatterns: ['.eslintrc.js', 'dist', 'node_modules'],
};
