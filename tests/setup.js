/**
 * Test Setup - Jason Bot Trader
 * Configuração global para testes
 */

// Configura variáveis de ambiente para testes
process.env.NODE_ENV = 'test';
process.env.LOG_LEVEL = 'error'; // Reduz ruído nos testes

// Mock de .env para testes
process.env.PRIVATE_KEY = '0x' + '1'.repeat(64); // Private key fake
process.env.WALLET_ADDRESS = '0x' + '0'.repeat(40); // Endereço fake
process.env.ARBITRUM_TESTNET_RPC_URL = 'http://localhost:8545'; // RPC local
process.env.INFURA_API_KEY = 'test_key';
process.env.ACTIVE_NETWORK = 'arbitrum';
process.env.NETWORK_MODE = 'testnet';
process.env.INITIAL_CAPITAL = '50';

// Timeout global
jest.setTimeout(30000);

// Suprime warnings específicos
const originalWarn = console.warn;
console.warn = (...args) => {
  if (args[0]?.includes('MaxListenersExceededWarning')) {
    return;
  }
  originalWarn.apply(console, args);
};
