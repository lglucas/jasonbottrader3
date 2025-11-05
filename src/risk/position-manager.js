/**
 * Position Manager - Jason Bot Trader
 * Versão: 0.2.0
 *
 * Gerencia tamanho de posições para controlar risco
 * Máximo de 10% do capital por trade
 */

const { config } = require('../core/config');
const { logger } = require('../reporting/logger');

/**
 * Classe para gerenciar tamanho de posições
 */
class PositionManager {
  constructor() {
    this.maxPositionPercent = config.bot.maxPositionPercent;
    this.currentCapital = config.bot.initialCapital;
    this.openPositions = new Map(); // pair -> position
  }

  /**
   * Atualiza capital disponível
   */
  updateCapital(newCapital) {
    const change = ((newCapital - this.currentCapital) / this.currentCapital) * 100;

    logger.info(`💰 Capital atualizado: $${this.currentCapital.toFixed(2)} → $${newCapital.toFixed(2)} (${change >= 0 ? '+' : ''}${change.toFixed(2)}%)`);

    this.currentCapital = newCapital;
  }

  /**
   * Retorna capital disponível
   */
  getAvailableCapital() {
    // Capital disponível = Capital total - Capital em posições abertas
    let capitalInPositions = 0;

    for (const [_, position] of this.openPositions) {
      capitalInPositions += position.investedAmount;
    }

    return this.currentCapital - capitalInPositions;
  }

  /**
   * Calcula tamanho máximo de posição baseado no capital
   *
   * @param {Number} currentPrice - Preço atual do ativo
   * @param {Number} volatility - Volatilidade do ativo (opcional)
   * @returns {Object} - { amountUSD, amountToken, percent }
   */
  calculatePositionSize(currentPrice, volatility = null) {
    const availableCapital = this.getAvailableCapital();

    // Tamanho base: % do capital disponível
    let baseAmount = availableCapital * this.maxPositionPercent;

    // Ajusta baseado na volatilidade (se fornecida)
    if (volatility !== null) {
      // Alta volatilidade → reduz posição
      // Baixa volatilidade → mantém posição
      const volatilityAdjustment = Math.max(0.5, 1 - (volatility / 0.5));
      baseAmount *= volatilityAdjustment;

      logger.debug(`Ajuste por volatilidade: ${(volatilityAdjustment * 100).toFixed(0)}%`);
    }

    // Calcula quantidade de tokens
    const amountToken = baseAmount / currentPrice;

    return {
      amountUSD: baseAmount,
      amountToken: amountToken,
      percent: (baseAmount / this.currentCapital) * 100,
    };
  }

  /**
   * Abre uma nova posição
   */
  openPosition(pair, entryPrice, amountUSD, amountToken) {
    if (this.hasOpenPosition(pair)) {
      logger.warn(`⚠️  Já existe posição aberta para ${pair}`);
      return false;
    }

    const position = {
      pair,
      entryPrice,
      entryTime: new Date().toISOString(),
      investedAmount: amountUSD,
      tokenAmount: amountToken,
      currentPrice: entryPrice,
      unrealizedPnL: 0,
      unrealizedPnLPercent: 0,
    };

    this.openPositions.set(pair, position);

    logger.info(`📈 Posição ABERTA: ${pair} @ $${entryPrice.toFixed(2)} (${amountToken.toFixed(6)} tokens, $${amountUSD.toFixed(2)})`);

    return true;
  }

  /**
   * Atualiza preço de posição aberta
   */
  updatePosition(pair, currentPrice) {
    const position = this.openPositions.get(pair);

    if (!position) {
      logger.warn(`⚠️  Posição não encontrada: ${pair}`);
      return null;
    }

    position.currentPrice = currentPrice;

    // Calcula P&L não realizado
    const currentValue = position.tokenAmount * currentPrice;
    position.unrealizedPnL = currentValue - position.investedAmount;
    position.unrealizedPnLPercent = (position.unrealizedPnL / position.investedAmount) * 100;

    logger.debug(`Posição atualizada ${pair}: P&L ${position.unrealizedPnLPercent.toFixed(2)}%`);

    return position;
  }

  /**
   * Fecha posição
   */
  closePosition(pair, exitPrice) {
    const position = this.openPositions.get(pair);

    if (!position) {
      logger.warn(`⚠️  Posição não encontrada: ${pair}`);
      return null;
    }

    // Calcula P&L realizado
    const exitValue = position.tokenAmount * exitPrice;
    const realizedPnL = exitValue - position.investedAmount;
    const realizedPnLPercent = (realizedPnL / position.investedAmount) * 100;

    // Atualiza capital
    this.updateCapital(this.currentCapital + realizedPnL);

    // Remove posição
    this.openPositions.delete(pair);

    logger.info(`📉 Posição FECHADA: ${pair} @ $${exitPrice.toFixed(2)}`);
    logger.info(`  P&L: ${realizedPnLPercent >= 0 ? '+' : ''}$${realizedPnL.toFixed(2)} (${realizedPnLPercent.toFixed(2)}%)`);
    logger.info(`  Duração: ${this.calculateDuration(position.entryTime)}`);

    return {
      pair,
      entryPrice: position.entryPrice,
      exitPrice,
      entryTime: position.entryTime,
      exitTime: new Date().toISOString(),
      investedAmount: position.investedAmount,
      tokenAmount: position.tokenAmount,
      realizedPnL,
      realizedPnLPercent,
    };
  }

  /**
   * Verifica se tem posição aberta para um par
   */
  hasOpenPosition(pair) {
    return this.openPositions.has(pair);
  }

  /**
   * Retorna posição aberta
   */
  getPosition(pair) {
    return this.openPositions.get(pair) || null;
  }

  /**
   * Retorna todas as posições abertas
   */
  getAllPositions() {
    return Array.from(this.openPositions.values());
  }

  /**
   * Calcula exposição total atual
   */
  getTotalExposure() {
    let totalInvested = 0;

    for (const [_, position] of this.openPositions) {
      totalInvested += position.investedAmount;
    }

    return {
      totalInvested,
      percent: (totalInvested / this.currentCapital) * 100,
      numPositions: this.openPositions.size,
    };
  }

  /**
   * Calcula P&L não realizado total
   */
  getTotalUnrealizedPnL() {
    let totalPnL = 0;

    for (const [_, position] of this.openPositions) {
      totalPnL += position.unrealizedPnL || 0;
    }

    return {
      amount: totalPnL,
      percent: this.currentCapital > 0 ? (totalPnL / this.currentCapital) * 100 : 0,
    };
  }

  /**
   * Calcula duração da posição
   */
  calculateDuration(entryTime) {
    const start = new Date(entryTime);
    const end = new Date();
    const durationMs = end - start;

    const hours = Math.floor(durationMs / (1000 * 60 * 60));
    const minutes = Math.floor((durationMs % (1000 * 60 * 60)) / (1000 * 60));

    return `${hours}h ${minutes}min`;
  }

  /**
   * Verifica se pode abrir nova posição
   */
  canOpenPosition() {
    const availableCapital = this.getAvailableCapital();
    const minPositionSize = 10; // $10 mínimo

    if (availableCapital < minPositionSize) {
      logger.warn(`⚠️  Capital insuficiente para nova posição: $${availableCapital.toFixed(2)}`);
      return false;
    }

    return true;
  }

  /**
   * Retorna resumo do position manager
   */
  getSummary() {
    const exposure = this.getTotalExposure();
    const unrealizedPnL = this.getTotalUnrealizedPnL();

    return {
      currentCapital: this.currentCapital,
      availableCapital: this.getAvailableCapital(),
      totalExposure: exposure.totalInvested,
      exposurePercent: exposure.percent,
      openPositions: exposure.numPositions,
      unrealizedPnL: unrealizedPnL.amount,
      unrealizedPnLPercent: unrealizedPnL.percent,
    };
  }

  /**
   * Reseta position manager
   */
  reset() {
    this.currentCapital = config.bot.initialCapital;
    this.openPositions.clear();
    logger.info('Position Manager resetado');
  }
}

// Singleton instance
const positionManager = new PositionManager();

module.exports = {
  positionManager,
  PositionManager,
};
