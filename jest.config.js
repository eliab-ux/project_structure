module.exports = {
  // Não há mais `apps/`: num repositório próprio, backend e frontend são workspaces de primeiro
  // nível. O backend tem `jest.config.ts` próprio (unitários + integração); o frontend ainda não
  // tem suíte.
  projects: ['<rootDir>/packages/*/jest.config.js', '<rootDir>/backend/jest.config.ts'],
  coverageDirectory: '<rootDir>/coverage',
  collectCoverageFrom: [
    '**/src/**/*.ts',
    '!**/src/**/*.spec.ts',
    '!**/src/**/*.test.ts',
    '!**/node_modules/**',
    '!**/dist/**',
  ],
};
