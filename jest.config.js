/**
 * Jest Configuration - Jason Bot Trader
 * Versão: 0.1.0
 */

module.exports = {
  // Ambiente de teste
  testEnvironment: 'node',

  // Padrão de arquivos de teste
  testMatch: [
    '**/tests/**/*.test.js',
    '**/tests/**/*.spec.js',
  ],

  // Cobertura de código
  collectCoverageFrom: [
    'src/**/*.js',
    '!src/**/*.test.js',
    '!src/**/*.spec.js',
  ],

  // Diretório de cobertura
  coverageDirectory: 'coverage',

  // Threshold de cobertura (desejável > 70%)
  coverageThresholds: {
    global: {
      branches: 50,
      functions: 50,
      lines: 50,
      statements: 50,
    },
  },

  // Timeout de teste (30 segundos para testes com blockchain)
  testTimeout: 30000,

  // Setup files
  setupFilesAfterEnv: ['<rootDir>/tests/setup.js'],

  // Transformações
  transform: {},

  // Verbose output
  verbose: true,

  // Clear mocks entre testes
  clearMocks: true,
  resetMocks: true,
  restoreMocks: true,
};
