/**
 * Wallet Manager - Jason Bot Trader
 * Versão: 0.1.0
 *
 * Gerencia wallet e signer para executar transações
 */

const { ethers } = require('ethers');
const { config } = require('../core/config');
const { logger } = require('../reporting/logger');
const { providerManager } = require('./provider');

/**
 * Classe para gerenciar wallet
 */
class WalletManager {
  constructor() {
    this.wallet = null;
    this.signer = null;
  }

  /**
   * Inicializa wallet com provider
   */
  async initialize() {
    try {
      logger.info('Inicializando wallet...');

      // Valida configuração
      if (!config.wallet.privateKey || config.wallet.privateKey === 'your_private_key_here') {
        throw new Error('PRIVATE_KEY não configurada no .env');
      }

      if (!config.wallet.address || config.wallet.address === 'your_wallet_address_here') {
        throw new Error('WALLET_ADDRESS não configurada no .env');
      }

      // Pega provider
      const provider = providerManager.getProvider();

      // Cria wallet
      this.wallet = new ethers.Wallet(config.wallet.privateKey, provider);

      // Signer é o próprio wallet conectado ao provider
      this.signer = this.wallet;

      // Valida endereço
      const derivedAddress = await this.wallet.getAddress();
      if (derivedAddress.toLowerCase() !== config.wallet.address.toLowerCase()) {
        logger.warn('⚠️  Endereço derivado da chave privada difere do configurado!');
        logger.warn(`  Configurado: ${config.wallet.address}`);
        logger.warn(`  Derivado: ${derivedAddress}`);
      }

      // Verifica saldo
      const balance = await this.getBalance();
      const networkInfo = providerManager.getNetworkInfo();

      logger.info(`✅ Wallet inicializada: ${this.wallet.address}`);
      logger.info(`Saldo: ${balance} ${networkInfo.nativeCurrency.symbol}`);

      return this.wallet;
    } catch (error) {
      logger.error('Falha ao inicializar wallet:', error);
      throw error;
    }
  }

  /**
   * Retorna signer para executar transações
   */
  getSigner() {
    if (!this.signer) {
      throw new Error('Wallet não inicializada. Chame initialize() primeiro.');
    }
    return this.signer;
  }

  /**
   * Retorna endereço da wallet
   */
  getAddress() {
    if (!this.wallet) {
      throw new Error('Wallet não inicializada');
    }
    return this.wallet.address;
  }

  /**
   * Retorna saldo nativo da wallet
   */
  async getBalance() {
    try {
      const balance = await providerManager.getNativeBalance(this.wallet.address);
      return parseFloat(balance).toFixed(6);
    } catch (error) {
      logger.error('Erro ao obter saldo:', error);
      throw error;
    }
  }

  /**
   * Retorna saldo de um token ERC20
   */
  async getTokenBalance(tokenAddress) {
    try {
      const tokenContract = new ethers.Contract(
        tokenAddress,
        [
          'function balanceOf(address) view returns (uint256)',
          'function decimals() view returns (uint8)',
          'function symbol() view returns (string)',
        ],
        this.signer
      );

      const [balance, decimals, symbol] = await Promise.all([
        tokenContract.balanceOf(this.wallet.address),
        tokenContract.decimals(),
        tokenContract.symbol(),
      ]);

      const formatted = ethers.formatUnits(balance, decimals);

      return {
        balance: formatted,
        decimals,
        symbol,
        raw: balance.toString(),
      };
    } catch (error) {
      logger.error(`Erro ao obter saldo do token ${tokenAddress}:`, error);
      throw error;
    }
  }

  /**
   * Aprova token para um spender (ex: Router)
   */
  async approveToken(tokenAddress, spenderAddress, amount) {
    try {
      logger.info(`Aprovando ${amount} tokens para ${spenderAddress}...`);

      const tokenContract = new ethers.Contract(
        tokenAddress,
        [
          'function approve(address spender, uint256 amount) returns (bool)',
          'function allowance(address owner, address spender) view returns (uint256)',
        ],
        this.signer
      );

      // Verifica allowance atual
      const currentAllowance = await tokenContract.allowance(
        this.wallet.address,
        spenderAddress
      );

      if (currentAllowance >= amount) {
        logger.info('Token já possui allowance suficiente');
        return null;
      }

      // Aprova
      const tx = await tokenContract.approve(spenderAddress, amount);
      logger.info(`Transação de aprovação enviada: ${tx.hash}`);

      const receipt = await tx.wait();

      if (receipt.status === 1) {
        logger.info('✅ Token aprovado com sucesso');
      } else {
        logger.error('❌ Aprovação falhou');
      }

      return receipt;
    } catch (error) {
      logger.error('Erro ao aprovar token:', error);
      throw error;
    }
  }

  /**
   * Envia transação com retry automático
   */
  async sendTransaction(tx, retries = 3) {
    let lastError;

    for (let i = 0; i < retries; i++) {
      try {
        logger.debug(`Tentativa ${i + 1}/${retries} de enviar transação...`);

        const txResponse = await this.signer.sendTransaction(tx);
        logger.info(`Transação enviada: ${txResponse.hash}`);

        return txResponse;
      } catch (error) {
        lastError = error;
        logger.warn(`Tentativa ${i + 1} falhou:`, error.message);

        if (i < retries - 1) {
          // Aguarda antes de tentar novamente (exponential backoff)
          const delay = 2000 * Math.pow(2, i);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }

    logger.error('Todas as tentativas de enviar transação falharam');
    throw lastError;
  }

  /**
   * Estima gas para uma transação
   */
  async estimateGas(tx) {
    try {
      const gasEstimate = await this.signer.estimateGas(tx);
      return gasEstimate;
    } catch (error) {
      logger.error('Erro ao estimar gas:', error);
      throw error;
    }
  }
}

// Singleton instance
const walletManager = new WalletManager();

module.exports = {
  walletManager,
  WalletManager,
};
