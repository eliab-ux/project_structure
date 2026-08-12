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
  // UM worker, sempre. Todo spec deste projeto conversa com o MESMO banco: os de execução criam e
  // apagam contas, o de isolamento cria fixtures e confere policies. Em paralelo, o `beforeAll` de
  // um apaga a fixture que o outro acabou de criar, e a falha resultante é intermitente e mentirosa
  // — aponta para a asserção, não para a corrida.
  //
  // Alternativa descartada: um schema (ou banco) por worker. É mais rápido e é o caminho certo se a
  // suíte crescer a ponto de o tempo incomodar, mas exigiria provisionar papéis e privilégios por
  // schema — divergindo do `001_create_roles.sql`, que é justamente o artefato cujo comportamento
  // os testes de isolamento existem para verificar. Testar contra um provisionamento que não é o de
  // produção anularia o propósito.
  maxWorkers: 1,
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
