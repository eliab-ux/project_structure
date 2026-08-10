// Inherits everything from the monorepo root config; only points typed linting at a TSConfig
// that covers both the src and the test trees. The root tsconfig.json excludes spec files, so
// without this they fail to parse ("TSConfig does not include this file").
module.exports = {
  parserOptions: {
    project: ['./tsconfig.spec.json'],
    tsconfigRootDir: __dirname,
  },
  ignorePatterns: ['.eslintrc.js', 'dist', 'node_modules'],
};
