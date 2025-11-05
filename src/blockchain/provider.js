/**
 * Provider Blockchain - Jason Bot Trader
 * Versão: 0.1.0
 *
 * Gerencia providers para múltiplas redes (Arbitrum, Base, Polygon)
 * Suporta testnet e mainnet com fallback automático
 */

const { ethers } = require('ethers');
const { config } = require('../core/config');
const { logger } = require('../reporting/logger');

/**
 * Configuração de redes suportadas
 */
const NETWORKS = {
  arbitrum: {
    name: 'Arbitrum',
    chainId: {
      mainnet: 42161,
      testnet: 421614, // Arbitrum Sepolia
    },
    nativeCurrency: {
      name: 'Ether',
      symbol: 'ETH',
      decimals: 18,
    },
  },
  base: {
    name: 'Base',
    chainId: {
      mainnet: 8453,
      testnet: 84532, // Base Sepolia
    },
    nativeCurrency: {
      name: 'Ether',
      symbol: 'ETH',
      decimals: 18,
    },
  },
  polygon: {
    name: 'Polygon',
    chainId: {
      mainnet: 137,
      testnet: 80002, // Polygon Amoy (substitui Mumbai)
    },
    nativeCurrency: {
      name: 'MATIC',
      symbol: 'MATIC',
      decimals: 18,
    },
  },
};

/**
 * Classe para gerenciar providers
 */
class ProviderManager {
  constructor() {
    this.providers = new Map();
    this.currentProvider = null;
    this.currentNetwork = null;
  }

  /**
   * Inicializa provider para a rede ativa
   */
  async initialize() {
    const networkKey = config.network.active;
    const mode = config.network.mode;

    logger.info(`Inicializando provider para ${networkKey} (${mode})...`);

    try {
      const provider = await this.createProvider(networkKey, mode);
      this.currentProvider = provider;
      this.currentNetwork = networkKey;

      // Valida conexão
      await this.validateConnection();

      logger.info(`✅ Provider ${networkKey} inicializado com sucesso`);
      return provider;
    } catch (error) {
      logger.error(`Falha ao inicializar provider ${networkKey}:`, error);
      throw error;
    }
  }

  /**
   * Cria provider para uma rede específica
   */
  async createProvider(networkKey, mode = 'testnet') {
    const network = NETWORKS[networkKey];
    if (!network) {
      throw new Error(`Rede não suportada: ${networkKey}`);
    }

    // Pega RPC URL do config
    const rpcUrl = mode === 'testnet'
      ? config.network.testnet[networkKey]
      : config.network.mainnet[networkKey];

    if (!rpcUrl) {
      throw new Error(`RPC URL não configurado para ${networkKey} (${mode})`);
    }

    logger.debug(`Criando provider: ${rpcUrl}`);

    // Cria provider com configuração de rede
    const chainId = network.chainId[mode];
    const provider = new ethers.JsonRpcProvider(rpcUrl, {
      chainId,
      name: `${network.name} ${mode === 'testnet' ? 'Testnet' : 'Mainnet'}`,
    });

    // Configura timeout (10 segundos)
    provider._getConnection().timeout = 10000;

    // Armazena no cache
    const key = `${networkKey}-${mode}`;
    this.providers.set(key, provider);

    return provider;
  }

  /**
   * Valida conexão com o provider
   */
  async validateConnection() {
    try {
      const network = await this.currentProvider.getNetwork();
      const blockNumber = await this.currentProvider.getBlockNumber();

      logger.info(`Conectado à rede: ${network.name} (Chain ID: ${network.chainId})`);
      logger.info(`Bloco atual: ${blockNumber}`);

      return true;
    } catch (error) {
      logger.error('Falha ao validar conexão:', error);
      throw new Error('Provider não está conectado corretamente');
    }
  }

  /**
   * Retorna provider atual
   */
  getProvider() {
    if (!this.currentProvider) {
      throw new Error('Provider não inicializado. Chame initialize() primeiro.');
    }
    return this.currentProvider;
  }

  /**
   * Retorna provider para uma rede específica
   */
  async getProviderForNetwork(networkKey, mode = 'testnet') {
    const key = `${networkKey}-${mode}`;

    // Retorna do cache se existir
    if (this.providers.has(key)) {
      return this.providers.get(key);
    }

    // Cria novo provider
    return await this.createProvider(networkKey, mode);
  }

  /**
   * Troca de rede dinamicamente
   */
  async switchNetwork(networkKey, mode = null) {
    const targetMode = mode || config.network.mode;

    logger.info(`Trocando para rede ${networkKey} (${targetMode})...`);

    try {
      const provider = await this.getProviderForNetwork(networkKey, targetMode);
      this.currentProvider = provider;
      this.currentNetwork = networkKey;

      await this.validateConnection();

      logger.info(`✅ Rede trocada para ${networkKey}`);
      return provider;
    } catch (error) {
      logger.error(`Falha ao trocar para ${networkKey}:`, error);
      throw error;
    }
  }

  /**
   * Retorna informações da rede atual
   */
  getNetworkInfo() {
    if (!this.currentNetwork) {
      return null;
    }

    const network = NETWORKS[this.currentNetwork];
    const mode = config.network.mode;

    return {
      key: this.currentNetwork,
      name: network.name,
      chainId: network.chainId[mode],
      mode,
      nativeCurrency: network.nativeCurrency,
    };
  }

  /**
   * Retorna saldo nativo da wallet
   */
  async getNativeBalance(address) {
    try {
      const balance = await this.currentProvider.getBalance(address);
      return ethers.formatEther(balance);
    } catch (error) {
      logger.error('Erro ao obter saldo nativo:', error);
      throw error;
    }
  }

  /**
   * Retorna preço do gas atual
   */
  async getGasPrice() {
    try {
      const feeData = await this.currentProvider.getFeeData();
      return {
        gasPrice: feeData.gasPrice ? ethers.formatUnits(feeData.gasPrice, 'gwei') : null,
        maxFeePerGas: feeData.maxFeePerGas ? ethers.formatUnits(feeData.maxFeePerGas, 'gwei') : null,
        maxPriorityFeePerGas: feeData.maxPriorityFeePerGas ? ethers.formatUnits(feeData.maxPriorityFeePerGas, 'gwei') : null,
      };
    } catch (error) {
      logger.error('Erro ao obter preço do gas:', error);
      throw error;
    }
  }

  /**
   * Aguarda confirmação de transação
   */
  async waitForTransaction(txHash, confirmations = 1, timeout = 60000) {
    try {
      logger.debug(`Aguardando ${confirmations} confirmação(ões) de ${txHash}...`);

      const receipt = await this.currentProvider.waitForTransaction(
        txHash,
        confirmations,
        timeout
      );

      if (receipt.status === 1) {
        logger.info(`✅ Transação confirmada: ${txHash}`);
      } else {
        logger.error(`❌ Transação falhou: ${txHash}`);
      }

      return receipt;
    } catch (error) {
      logger.error('Erro ao aguardar transação:', error);
      throw error;
    }
  }

  /**
   * Limpa cache de providers
   */
  clearCache() {
    this.providers.clear();
    logger.debug('Cache de providers limpo');
  }
}

// Singleton instance
const providerManager = new ProviderManager();

module.exports = {
  providerManager,
  ProviderManager,
  NETWORKS,
};
