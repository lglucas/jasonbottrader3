/**
 * Grid Trading Strategy - Jason Bot Trader
 * Versão: 0.2.0
 *
 * Estratégia que coloca ordens de compra/venda em níveis fixos (grid)
 * Funciona bem em mercados laterais (consolidação)
 */

const BaseStrategy = require('./base');
const { logger } = require('../reporting/logger');
const { config } = require('../core/config');

/**
 * Estratégia Grid Trading
 *
 * Cria uma "grade" de níveis de preço para compra e venda
 * Exemplo: Preço inicial $100
 * - Nível 1 (Compra): $95 (-5%)
 * - Nível 2 (Compra): $97.5 (-2.5%)
 * - Nível 3 (Neutro): $100
 * - Nível 4 (Venda): $102.5 (+2.5%)
 * - Nível 5 (Venda): $105 (+5%)
 */
class GridTradingStrategy extends BaseStrategy {
  constructor(customConfig = {}) {
    const defaultConfig = {
      ...config.strategies.grid,
      ...customConfig,
    };

    super('Grid Trading', defaultConfig);

    this.gridLevels = [];
    this.basePrice = null;
    this.lastRebalance = null;
  }

  /**
   * Inicializa grid com preço base
   */
  initialize(basePrice) {
    this.basePrice = basePrice;
    this.gridLevels = this.calculateGridLevels(basePrice);
    this.lastRebalance = Date.now();

    logger.info(`🔲 Grid inicializado com preço base $${basePrice.toFixed(2)}`);
    logger.info(`Níveis: ${this.gridLevels.length} níveis de ${this.config.rangeMin * 100}% a ${this.config.rangeMax * 100}%`);
  }

  /**
   * Calcula níveis do grid
   */
  calculateGridLevels(basePrice) {
    const levels = [];
    const { levels: numLevels, rangeMin, rangeMax, amountPerLevel } = this.config;

    // Calcula step entre níveis
    const range = rangeMax - rangeMin;
    const step = range / (numLevels - 1);

    for (let i = 0; i < numLevels; i++) {
      const multiplier = rangeMin + (step * i);
      const price = basePrice * (1 + multiplier);
      const action = multiplier < 0 ? 'buy' : (multiplier > 0 ? 'sell' : 'neutral');

      levels.push({
        levelIndex: i,
        price: price,
        multiplier: multiplier,
        action: action,
        amountPercent: amountPerLevel,
        isTriggered: false,
      });
    }

    return levels;
  }

  /**
   * Verifica se pode operar (mercado lateral)
   */
  canTrade(marketData) {
    if (!this.validateMarketData(marketData)) {
      return false;
    }

    // Grid funciona melhor em mercados com baixa volatilidade
    if (marketData.volatility && marketData.volatility > 0.15) {
      logger.debug('[Grid] Volatilidade alta, não recomendado');
      return false;
    }

    // Precisa de liquidez mínima
    if (marketData.liquidity < config.analysis.minLiquidity) {
      logger.debug('[Grid] Liquidez insuficiente');
      return false;
    }

    return true;
  }

  /**
   * Analisa mercado e retorna sinal
   */
  async analyze(marketData) {
    if (!this.isActive) {
      return null;
    }

    // Inicializa grid se necessário
    if (!this.basePrice) {
      this.initialize(marketData.price);
    }

    // Verifica se precisa rebalancear
    if (this.shouldRebalance()) {
      this.rebalance(marketData.price);
    }

    // Encontra nível mais próximo
    const currentPrice = marketData.price;
    const closestLevel = this.findClosestLevel(currentPrice);

    if (!closestLevel) {
      return null;
    }

    // Calcula distância do nível
    const distance = Math.abs((currentPrice - closestLevel.price) / closestLevel.price);

    // Se preço está muito próximo de um nível (< 0.5%), gera sinal
    if (distance < 0.005 && !closestLevel.isTriggered) {
      const signal = {
        action: closestLevel.action,
        confidence: 0.8, // Grid tem confiança moderada
        reason: `Preço atingiu nível ${closestLevel.levelIndex + 1} ($${closestLevel.price.toFixed(2)})`,
        price: currentPrice,
        levelIndex: closestLevel.levelIndex,
        amountPercent: closestLevel.amountPercent,
      };

      // Marca nível como triggered
      closestLevel.isTriggered = true;

      this.recordSignal(signal);

      return signal;
    }

    return null;
  }

  /**
   * Encontra nível mais próximo do preço atual
   */
  findClosestLevel(currentPrice) {
    let closest = null;
    let minDistance = Infinity;

    for (const level of this.gridLevels) {
      const distance = Math.abs(currentPrice - level.price);

      if (distance < minDistance) {
        minDistance = distance;
        closest = level;
      }
    }

    return closest;
  }

  /**
   * Verifica se deve rebalancear o grid
   */
  shouldRebalance() {
    if (!this.lastRebalance) {
      return false;
    }

    const timeSinceRebalance = Date.now() - this.lastRebalance;
    const rebalanceInterval = this.config.rebalanceInterval * 1000; // converte para ms

    return timeSinceRebalance >= rebalanceInterval;
  }

  /**
   * Rebalanceia grid com novo preço base
   */
  rebalance(newBasePrice) {
    const priceChange = this.calculatePriceChange(newBasePrice, this.basePrice);

    // Só rebalancea se preço mudou significativamente (> 5%)
    if (Math.abs(priceChange) < 5) {
      return;
    }

    logger.info(`🔄 Rebalanceando grid: $${this.basePrice.toFixed(2)} → $${newBasePrice.toFixed(2)} (${priceChange.toFixed(2)}%)`);

    // Reseta níveis triggered
    this.gridLevels.forEach(level => {
      level.isTriggered = false;
    });

    // Recalcula níveis
    this.gridLevels = this.calculateGridLevels(newBasePrice);
    this.basePrice = newBasePrice;
    this.lastRebalance = Date.now();
  }

  /**
   * Retorna estado atual do grid
   */
  getGridState() {
    return {
      basePrice: this.basePrice,
      levels: this.gridLevels.map(l => ({
        index: l.levelIndex,
        price: l.price.toFixed(2),
        action: l.action,
        triggered: l.isTriggered,
      })),
      lastRebalance: this.lastRebalance ? new Date(this.lastRebalance).toISOString() : null,
    };
  }

  /**
   * Reseta grid completamente
   */
  reset() {
    this.gridLevels = [];
    this.basePrice = null;
    this.lastRebalance = null;
    this.resetMetrics();
    logger.info('Grid resetado');
  }

  /**
   * Override: Descrição específica do grid
   */
  toString() {
    return `Grid Trading (Base: $${this.basePrice?.toFixed(2) || 'N/A'}, Levels: ${this.gridLevels.length}, Active: ${this.isActive})`;
  }
}

module.exports = GridTradingStrategy;
