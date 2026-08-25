const nextJest = require('next/jest');

/**
 * Jest for the frontend.
 *
 * `next/jest` is used rather than a hand-rolled transform because it wires the same SWC pipeline, path
 * aliases and CSS/asset stubs the real build uses. A bespoke ts-jest config would compile these files
 * differently from how Next compiles them, which is a way to have tests that pass on code that breaks.
 */
const createJestConfig = nextJest({ dir: './' });

module.exports = createJestConfig({
  testEnvironment: 'jsdom',
  setupFilesAfterEnv: ['<rootDir>/test/setup.ts'],
  testMatch: ['<rootDir>/test/**/*.spec.ts', '<rootDir>/test/**/*.spec.tsx'],
  moduleNameMapper: {
    '^src/(.*)$': '<rootDir>/src/$1',
  },
  // The screens are the product; the type file and the theme have nothing to assert.
  collectCoverageFrom: ['src/**/*.{ts,tsx}', '!src/types/**', '!src/theme/**'],
});
