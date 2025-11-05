/**
 * ESLint Configuration - Jason Bot Trader
 */

module.exports = {
  env: {
    node: true,
    es2021: true,
    jest: true,
  },
  extends: [
    'eslint:recommended',
  ],
  parserOptions: {
    ecmaVersion: 'latest',
    sourceType: 'module',
  },
  rules: {
    // Possíveis erros
    'no-console': 'off', // Permitimos console.log para logs
    'no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],

    // Melhores práticas
    'eqeqeq': ['error', 'always'],
    'no-var': 'error',
    'prefer-const': 'warn',
    'prefer-arrow-callback': 'warn',

    // Estilo
    'indent': ['error', 2],
    'quotes': ['error', 'single', { avoidEscape: true }],
    'semi': ['error', 'always'],
    'comma-dangle': ['error', 'always-multiline'],
    'no-trailing-spaces': 'error',
    'eol-last': ['error', 'always'],

    // ES6+
    'arrow-spacing': 'error',
    'no-duplicate-imports': 'error',
  },
};
