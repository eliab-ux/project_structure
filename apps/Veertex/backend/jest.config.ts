import type { Config } from '@jest/types';

const config: Config.InitialOptions = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  rootDir: '.',
  roots: ['<rootDir>/test', '<rootDir>/src'],
  moduleFileExtensions: ['ts', 'tsx', 'js', 'json'],
  // Carrega o .env antes do framework de teste. Sem isto os testes de integração acusam variável
  // ausente quando ela existe — cada worker do Jest é um processo novo e não herda o dotenv do npm.
  setupFiles: ['<rootDir>/test/setup-env.ts'],
  // 30s. O padrão de 5s é curto demais para um teste que fala com o banco: um problema de rede
  // estourava o hook antes de o driver reportar a causa, e a saída dizia "Exceeded timeout of
  // 5000 ms for a hook" em vez de "ETIMEDOUT em host:porta" — escondendo justamente o que se
  // precisa saber para consertar.
  testTimeout: 30_000,
  moduleNameMapper: {
    '^@contexts/(.*)$': '<rootDir>/src/contexts/$1',
    '^@infrastructure/(.*)$': '<rootDir>/src/infrastructure/$1',
    '^@shared/(.*)$': '<rootDir>/src/shared/$1',
    '^@config/(.*)$': '<rootDir>/src/config/$1',
  },
  transform: {
    '^.+\\.tsx?$': ['ts-jest', { tsconfig: '<rootDir>/tsconfig.spec.json' }],
  },
};

export default config;
