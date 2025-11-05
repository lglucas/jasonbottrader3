/**
 * Gas Manager - Jason Bot Trader
 * Versão: 0.1.0
 *
 * Gerencia estimativa e otimização de gas
 * Cancela trades quando gas está muito alto
 */

const { ethers } = require('ethers');
const { config } = require('../core/config');
const { logger } = require('../reporting/logger');
const { providerManager } = require('./provider');
const { botEvents, EVENTS } = require('../core/events');

/**
 * Classe para gerenciar gas
 */
class GasManager {
  constructor() {
    this.gasPriceHistory = [];
    this.maxHistorySize = 100;
  }

  /**
   * Calcula gas máximo permitido para um trade
   * Fórmula: Gas Máximo = (Valor do Trade × MAX_GAS_PERCENT) ou 0.001 ETH, o que for maior
   */
  calculateMaxGas(tradeValueUSD, nativeTokenPriceUSD) {
    const maxGasPercent = config.risk.maxGasPercent; // ex: 0.02 (2%)
    const minGasETH = 0.001; // mínimo de 0.001 ETH

    // Gas máximo baseado no valor do trade
    const maxGasFromTrade = (tradeValueUSD * maxGasPercent) / nativeTokenPriceUSD;

    // Retorna o maior entre os dois
    const maxGas = Math.max(maxGasFromTrade, minGasETH);

    logger.debug(`Gas máximo calculado: ${maxGas.toFixed(6)} ETH (trade: $${tradeValueUSD})`);

    return maxGas;
  }

  /**
   * Estima gas total para uma transação (em ETH)
   */
  async estimateGasCost(tx) {
    try {
      const provider = providerManager.getProvider();

      // Estima gas limit
      const gasEstimate = await provider.estimateGas(tx);

      // Pega preço do gas atual
      const feeData = await provider.getFeeData();

      let gasCostWei;

      // Se suporta EIP-1559 (maxFeePerGas)
      if (feeData.maxFeePerGas) {
        gasCostWei = gasEstimate * feeData.maxFeePerGas;
      } else {
        // Fallback para gasPrice legacy
        gasCostWei = gasEstimate * feeData.gasPrice;
      }

      const gasCostETH = ethers.formatEther(gasCostWei);

      return {
        gasLimit: gasEstimate.toString(),
        gasPrice: feeData.gasPrice ? ethers.formatUnits(feeData.gasPrice, 'gwei') : null,
        maxFeePerGas: feeData.maxFeePerGas ? ethers.formatUnits(feeData.maxFeePerGas, 'gwei') : null,
        maxPriorityFeePerGas: feeData.maxPriorityFeePerGas ? ethers.formatUnits(feeData.maxPriorityFeePerGas, 'gwei') : null,
        totalCostETH: parseFloat(gasCostETH),
        totalCostWei: gasCostWei.toString(),
      };
    } catch (error) {
      logger.error('Erro ao estimar gas:', error);
      throw error;
    }
  }

  /**
   * Verifica se gas está aceitável para executar trade
   */
  async isGasAcceptable(tradeValueUSD, nativeTokenPriceUSD, tx) {
    try {
      // Calcula gas máximo permitido
      const maxGasETH = this.calculateMaxGas(tradeValueUSD, nativeTokenPriceUSD);

      // Estima gas da transação
      const gasCost = await this.estimateGasCost(tx);

      const isAcceptable = gasCost.totalCostETH <= maxGasETH;

      if (isAcceptable) {
        logger.info(`✅ Gas aceitável: ${gasCost.totalCostETH.toFixed(6)} ETH (max: ${maxGasETH.toFixed(6)} ETH)`);
        botEvents.emit(EVENTS.GAS_ACCEPTABLE, { gasCost, maxGasETH });
      } else {
        logger.warn(`⚠️  Gas muito alto: ${gasCost.totalCostETH.toFixed(6)} ETH (max: ${maxGasETH.toFixed(6)} ETH)`);
        botEvents.emit(EVENTS.GAS_TOO_HIGH, { gasCost, maxGasETH });
      }

      return {
        acceptable: isAcceptable,
        estimatedGas: gasCost.totalCostETH,
        maxGas: maxGasETH,
        details: gasCost,
      };
    } catch (error) {
      logger.error('Erro ao verificar gas:', error);
      throw error;
    }
  }

  /**
   * Retorna preço atual do gas
   */
  async getCurrentGasPrice() {
    try {
      const gasData = await providerManager.getGasPrice();

      // Adiciona ao histórico
      this.gasPriceHistory.push({
        timestamp: Date.now(),
        ...gasData,
      });

      // Limita tamanho do histórico
      if (this.gasPriceHistory.length > this.maxHistorySize) {
        this.gasPriceHistory.shift();
      }

      return gasData;
    } catch (error) {
      logger.error('Erro ao obter preço do gas:', error);
      throw error;
    }
  }

  /**
   * Calcula média de gas price (últimos N registros)
   */
  getAverageGasPrice(lastN = 20) {
    if (this.gasPriceHistory.length === 0) {
      return null;
    }

    const recentPrices = this.gasPriceHistory.slice(-lastN);
    const sum = recentPrices.reduce((acc, item) => {
      const price = item.maxFeePerGas || item.gasPrice;
      return acc + (price ? parseFloat(price) : 0);
    }, 0);

    return sum / recentPrices.length;
  }

  /**
   * Verifica se gas está em tendência de alta ou baixa
   */
  getGasTrend() {
    if (this.gasPriceHistory.length < 10) {
      return 'insufficient_data';
    }

    const recent = this.gasPriceHistory.slice(-10);
    const older = this.gasPriceHistory.slice(-20, -10);

    const avgRecent = recent.reduce((acc, item) => {
      const price = item.maxFeePerGas || item.gasPrice;
      return acc + (price ? parseFloat(price) : 0);
    }, 0) / recent.length;

    const avgOlder = older.reduce((acc, item) => {
      const price = item.maxFeePerGas || item.gasPrice;
      return acc + (price ? parseFloat(price) : 0);
    }, 0) / older.length;

    const diff = (avgRecent - avgOlder) / avgOlder;

    if (diff > 0.1) return 'rising';
    if (diff < -0.1) return 'falling';
    return 'stable';
  }

  /**
   * Aguarda gas baixar (polling com timeout)
   */
  async waitForLowerGas(maxGasETH, timeoutMs = 300000) {
    const startTime = Date.now();
    const checkInterval = 30000; // 30 segundos

    logger.info(`Aguardando gas baixar para ${maxGasETH.toFixed(6)} ETH (timeout: ${timeoutMs / 1000}s)...`);

    while (Date.now() - startTime < timeoutMs) {
      try {
        const currentGas = await this.getCurrentGasPrice();
        const provider = providerManager.getProvider();
        const feeData = await provider.getFeeData();

        // Calcula custo estimado (assumindo gas limit médio de 200k)
        const estimatedGasLimit = 200000n;
        const gasCostWei = estimatedGasLimit * (feeData.maxFeePerGas || feeData.gasPrice);
        const gasCostETH = parseFloat(ethers.formatEther(gasCostWei));

        if (gasCostETH <= maxGasETH) {
          logger.info(`✅ Gas baixou para nível aceitável: ${gasCostETH.toFixed(6)} ETH`);
          return true;
        }

        logger.debug(`Gas ainda alto: ${gasCostETH.toFixed(6)} ETH, aguardando...`);

        // Aguarda antes de checar novamente
        await new Promise(resolve => setTimeout(resolve, checkInterval));
      } catch (error) {
        logger.error('Erro ao checar gas:', error);
      }
    }

    logger.warn('⏱️  Timeout: gas não baixou no tempo esperado');
    return false;
  }

  /**
   * Otimiza configuração de gas para transação
   */
  async optimizeGasSettings(tx, priorityLevel = 'medium') {
    try {
      const provider = providerManager.getProvider();
      const feeData = await provider.getFeeData();

      const settings = { ...tx };

      // Se suporta EIP-1559
      if (feeData.maxFeePerGas) {
        // Ajusta baseado no nível de prioridade
        let multiplier;
        switch (priorityLevel) {
          case 'low':
            multiplier = 0.9;
            break;
          case 'high':
            multiplier = 1.2;
            break;
          case 'urgent':
            multiplier = 1.5;
            break;
          default: // medium
            multiplier = 1.0;
        }

        settings.maxFeePerGas = (feeData.maxFeePerGas * BigInt(Math.floor(multiplier * 100))) / 100n;
        settings.maxPriorityFeePerGas = (feeData.maxPriorityFeePerGas * BigInt(Math.floor(multiplier * 100))) / 100n;

        delete settings.gasPrice; // Remove gasPrice se usar EIP-1559
      } else {
        // Legacy gas price
        settings.gasPrice = feeData.gasPrice;
      }

      logger.debug(`Gas otimizado (${priorityLevel}):`, {
        maxFeePerGas: settings.maxFeePerGas ? ethers.formatUnits(settings.maxFeePerGas, 'gwei') : null,
        maxPriorityFeePerGas: settings.maxPriorityFeePerGas ? ethers.formatUnits(settings.maxPriorityFeePerGas, 'gwei') : null,
        gasPrice: settings.gasPrice ? ethers.formatUnits(settings.gasPrice, 'gwei') : null,
      });

      return settings;
    } catch (error) {
      logger.error('Erro ao otimizar gas:', error);
      throw error;
    }
  }
}

// Singleton instance
const gasManager = new GasManager();

module.exports = {
  gasManager,
  GasManager,
};
