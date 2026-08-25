// Herda tudo da config da raiz do monorepo; só aponta o lint tipado para um TSConfig que
// cobre src E test. O tsconfig.json de build exclui os specs, e sem isto eles não parseiam
// ("TSConfig does not include this file").
module.exports = {
  parserOptions: {
    project: ['./tsconfig.spec.json'],
    tsconfigRootDir: __dirname,
  },
  ignorePatterns: ['.eslintrc.js', 'dist', 'node_modules', 'scripts'],
};
