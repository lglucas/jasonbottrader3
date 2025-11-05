/**
 * Sistema de Configuração - Jason Bot Trader
 * Versão: 0.1.0
 *
 * Gerencia e valida todas as configurações do .env
 * Garante que variáveis obrigatórias existam antes de iniciar o bot
 */

require('dotenv').config();

/**
 * Valida se uma variável de ambiente existe
 */
function requireEnv(key, defaultValue = null) {
  const value = process.env[key];

  if (!value && defaultValue === null) {
    throw new Error(`Variável de ambiente obrigatória não encontrada: ${key}`);
  }

  return value || defaultValue;
}

/**
 * Converte string para boolean
 */
function parseBool(value, defaultValue = false) {
  if (value === undefined) return defaultValue;
  return value === 'true' || value === '1' || value === 'yes';
}

/**
 * Converte string para número
 */
function parseNumber(value, defaultValue = 0) {
  const parsed = parseFloat(value);
  return isNaN(parsed) ? defaultValue : parsed;
}

/**
 * Configurações do Bot
 */
const config = {
  // ============================================
  // AMBIENTE
  // ============================================
  env: requireEnv('NODE_ENV', 'development'),
  isDevelopment: process.env.NODE_ENV !== 'production',
  isProduction: process.env.NODE_ENV === 'production',
  logLevel: requireEnv('LOG_LEVEL', 'info'),

  // ============================================
  // WALLET
  // ============================================
  wallet: {
    privateKey: requireEnv('PRIVATE_KEY'),
    address: requireEnv('WALLET_ADDRESS'),
  },

  // ============================================
  // NETWORK
  // ============================================
  network: {
    active: requireEnv('ACTIVE_NETWORK', 'arbitrum'),
    mode: requireEnv('NETWORK_MODE', 'testnet'),
    isTestnet: requireEnv('NETWORK_MODE', 'testnet') === 'testnet',

    // RPCs Testnet
    testnet: {
      arbitrum: requireEnv('ARBITRUM_TESTNET_RPC_URL', null),
      base: requireEnv('BASE_TESTNET_RPC_URL', null),
      polygon: requireEnv('POLYGON_TESTNET_RPC_URL', null),
    },

    // RPCs Mainnet
    mainnet: {
      arbitrum: requireEnv('ARBITRUM_RPC_URL', null),
      base: requireEnv('BASE_RPC_URL', null),
      polygon: requireEnv('POLYGON_RPC_URL', null),
    },
  },

  // ============================================
  // API KEYS
  // ============================================
  apiKeys: {
    infura: requireEnv('INFURA_API_KEY', null),
    alchemy: process.env.ALCHEMY_API_KEY || null,
    coingecko: process.env.COINGECKO_API_KEY || null,
  },

  // ============================================
  // BOT CONFIGURATION
  // ============================================
  bot: {
    pollingInterval: parseNumber(process.env.POLLING_INTERVAL, 15),
    initialCapital: parseNumber(process.env.INITIAL_CAPITAL, 50),
    maxPositionPercent: parseNumber(process.env.MAX_POSITION_PERCENT, 0.10),
  },

  // ============================================
  // GESTÃO DE RISCO
  // ============================================
  risk: {
    stopLossTrailing: parseNumber(process.env.STOP_LOSS_TRAILING_PERCENT, 0.03),

    takeProfitLevels: [
      {
        percent: parseNumber(process.env.TAKE_PROFIT_LEVEL_1, 0.10),
        amount: 0.25, // 25% da posição
      },
      {
        percent: parseNumber(process.env.TAKE_PROFIT_LEVEL_2, 0.20),
        amount: 0.50, // 50% da posição
      },
      {
        percent: parseNumber(process.env.TAKE_PROFIT_LEVEL_3, 0.30),
        amount: 0.25, // 25% restante
      },
    ],

    maxDrawdown: parseNumber(process.env.MAX_DRAWDOWN_PERCENT, 0.15),

    drawdownLevels: [
      {
        percent: parseNumber(process.env.DRAWDOWN_LEVEL_1, 0.05),
        action: 'pause',
        duration: 1800, // 30 min
        message: 'Drawdown -5%: Pausando e trocando para estratégia conservadora',
      },
      {
        percent: parseNumber(process.env.DRAWDOWN_LEVEL_2, 0.10),
        action: 'pause_and_reset',
        duration: 7200, // 2h
        message: 'Drawdown -10%: Pausando 2h e resetando parâmetros',
      },
      {
        percent: parseNumber(process.env.MAX_DRAWDOWN_PERCENT, 0.15),
        action: 'stop',
        duration: null,
        message: 'Drawdown -15%: Bot parado! Intervenção manual necessária.',
      },
    ],

    maxGasPercent: parseNumber(process.env.MAX_GAS_PERCENT, 0.02),
    slippageTolerance: parseNumber(process.env.SLIPPAGE_TOLERANCE, 0.005),
    orderTimeout: parseNumber(process.env.ORDER_TIMEOUT, 30) * 1000, // converter para ms
  },

  // ============================================
  // ESTRATÉGIAS
  // ============================================
  strategies: {
    default: requireEnv('DEFAULT_STRATEGY', 'auto'),

    grid: {
      levels: parseNumber(process.env.GRID_LEVELS, 5),
      rangeMin: parseNumber(process.env.GRID_RANGE_MIN, 0.95),
      rangeMax: parseNumber(process.env.GRID_RANGE_MAX, 1.10),
      amountPerLevel: parseNumber(process.env.GRID_AMOUNT_PER_LEVEL, 0.02),
      rebalanceInterval: 300, // 5 minutos
    },

    momentum: {
      entryThreshold: parseNumber(process.env.MOMENTUM_ENTRY_THRESHOLD, 0.05),
      exitThreshold: parseNumber(process.env.MOMENTUM_EXIT_THRESHOLD, 0.03),
      volumeMultiplier: parseNumber(process.env.MOMENTUM_VOLUME_MULTIPLIER, 2),
      lookbackPeriod: 20,
      rsiEntry: parseNumber(process.env.MOMENTUM_RSI_ENTRY, 30),
      rsiExit: parseNumber(process.env.MOMENTUM_RSI_EXIT, 70),
    },
  },

  // ============================================
  // ANÁLISE SEMANAL
  // ============================================
  analysis: {
    minLiquidity: parseNumber(process.env.MIN_LIQUIDITY_USD, 75000),
    minVolume24h: parseNumber(process.env.MIN_VOLUME_24H_USD, 25000),
    minVolatility: parseNumber(process.env.MIN_VOLATILITY_PERCENT, 0.05),
    minMarketCap: parseNumber(process.env.MIN_MARKET_CAP_USD, 5000000),
    minPoolAge: parseNumber(process.env.MIN_POOL_AGE_DAYS, 10),

    scoreWeights: {
      liquidity: 0.30,
      volume: 0.25,
      volatility: 0.25,
      age: 0.10,
      marketCap: 0.10,
    },
  },

  // ============================================
  // DASHBOARD API
  // ============================================
  api: {
    port: parseNumber(process.env.API_PORT, 4000),
    host: requireEnv('API_HOST', 'localhost'),
    corsOrigin: requireEnv('CORS_ORIGIN', 'http://localhost:3000'),
  },

  // ============================================
  // SUSHISWAP CONTRACTS
  // ============================================
  contracts: {
    arbitrum: {
      factory: requireEnv('SUSHISWAP_FACTORY_ADDRESS', '0x1af415a1EbA07a4986a52B6f2e7dE7003D82231e'),
      router: requireEnv('SUSHISWAP_ROUTER_ADDRESS', '0xFB7eF66a7e61224DD6FcD0D7d9C3be5C8B049b9f'),
      quoter: requireEnv('SUSHISWAP_QUOTER_ADDRESS', '0x64e8802FE490fa7cc61d3463958199161Bb608A7'),
    },
    // Base e Polygon usam mesmos contratos (verificar na documentação)
    base: {
      factory: '0x1af415a1EbA07a4986a52B6f2e7dE7003D82231e',
      router: '0xFB7eF66a7e61224DD6FcD0D7d9C3be5C8B049b9f',
      quoter: '0x64e8802FE490fa7cc61d3463958199161Bb608A7',
    },
    polygon: {
      factory: '0x1af415a1EbA07a4986a52B6f2e7dE7003D82231e',
      router: '0xFB7eF66a7e61224DD6FcD0D7d9C3be5C8B049b9f',
      quoter: '0x64e8802FE490fa7cc61d3463958199161Bb608A7',
    },
  },

  // ============================================
  // LOGGING E STORAGE
  // ============================================
  paths: {
    logs: requireEnv('LOG_DIR', './logs'),
    data: requireEnv('DATA_DIR', './data'),
    reports: requireEnv('REPORTS_DIR', './data/reports'),
  },

  retention: {
    logs: parseNumber(process.env.LOG_ROTATION_DAYS, 7),
    data: parseNumber(process.env.DATA_RETENTION_DAYS, 30),
  },
};

/**
 * Valida configurações críticas
 */
function validateConfig() {
  const errors = [];

  // Valida wallet
  if (!config.wallet.privateKey || config.wallet.privateKey === 'your_private_key_here') {
    errors.push('PRIVATE_KEY não configurada');
  }

  if (!config.wallet.address || config.wallet.address === 'your_wallet_address_here') {
    errors.push('WALLET_ADDRESS não configurada');
  }

  // Valida RPC da rede ativa
  const activeRpc = config.network.isTestnet
    ? config.network.testnet[config.network.active]
    : config.network.mainnet[config.network.active];

  if (!activeRpc) {
    errors.push(`RPC não configurado para rede ${config.network.active} (${config.network.mode})`);
  }

  // Valida API keys
  if (!config.apiKeys.infura && !config.apiKeys.alchemy) {
    errors.push('Nenhuma API key configurada (INFURA ou ALCHEMY necessária)');
  }

  // Valida parâmetros de risco
  if (config.risk.maxDrawdown < config.risk.drawdownLevels[1].percent) {
    errors.push('MAX_DRAWDOWN_PERCENT deve ser >= DRAWDOWN_LEVEL_2');
  }

  if (config.bot.maxPositionPercent > 0.2) {
    errors.push('MAX_POSITION_PERCENT não pode ser > 20% (risco muito alto)');
  }

  if (errors.length > 0) {
    console.error('❌ Erros de configuração encontrados:');
    errors.forEach(err => console.error(`  - ${err}`));
    throw new Error('Configuração inválida. Verifique seu arquivo .env');
  }
}

/**
 * Imprime resumo da configuração (sem dados sensíveis)
 */
function printConfigSummary() {
  console.log('\n📋 Configuração do Bot:');
  console.log(`  Ambiente: ${config.env}`);
  console.log(`  Rede: ${config.network.active} (${config.network.mode})`);
  console.log(`  Capital Inicial: $${config.bot.initialCapital}`);
  console.log(`  Max Posição: ${config.bot.maxPositionPercent * 100}%`);
  console.log(`  Polling: ${config.bot.pollingInterval}s`);
  console.log(`  Estratégia: ${config.strategies.default}`);
  console.log(`  Stop-Loss: ${config.risk.stopLossTrailing * 100}%`);
  console.log(`  Max Drawdown: ${config.risk.maxDrawdown * 100}%`);
  console.log('');
}

// Valida ao carregar
validateConfig();

module.exports = {
  config,
  validateConfig,
  printConfigSummary,
};
