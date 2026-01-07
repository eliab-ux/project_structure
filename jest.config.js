module.exports = {
  projects: ['<rootDir>/packages/*/jest.config.js', '<rootDir>/apps/*/jest.config.js'],
  coverageDirectory: '<rootDir>/coverage',
  collectCoverageFrom: [
    '**/src/**/*.ts',
    '!**/src/**/*.spec.ts',
    '!**/src/**/*.test.ts',
    '!**/node_modules/**',
    '!**/dist/**',
  ],
};
