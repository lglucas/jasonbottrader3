/**
 * Exit Manager - Jason Bot Trader
 * Versão: 0.2.0
 *
 * Gerencia saídas de posições:
 * - Stop-loss trailing
 * - Take-profit em níveis (25%, 50%, 25%)
 */

const { config } = require('../core/config');
const { logger } = require('../reporting/logger');
const { botEvents, EVENTS } = require('../core/events');

/**
 * Gerencia stop-loss trailing para uma posição
 */
class TrailingStopLoss {
  constructor(entryPrice, trailingPercent = null) {
    this.entryPrice = entryPrice;
    this.trailingPercent = trailingPercent || config.risk.stopLossTrailing;
    this.highestPrice = entryPrice;
    this.stopPrice = entryPrice * (1 - this.trailingPercent);
    this.isTriggered = false;
  }

  /**
   * Atualiza com novo preço
   */
  update(currentPrice) {
    // Atualiza maior preço se necessário
    if (currentPrice > this.highestPrice) {
      this.highestPrice = currentPrice;
      this.stopPrice = currentPrice * (1 - this.trailingPercent);

      logger.debug(`Stop-loss atualizado: $${this.stopPrice.toFixed(2)} (pico: $${this.highestPrice.toFixed(2)})`);
    }

    // Verifica se stop foi atingido
    if (currentPrice <= this.stopPrice && !this.isTriggered) {
      this.isTriggered = true;

      const pnlPercent = ((currentPrice - this.entryPrice) / this.entryPrice) * 100;

      logger.warn(`🛑 STOP-LOSS TRIGGERED @ $${currentPrice.toFixed(2)} (P&L: ${pnlPercent.toFixed(2)}%)`);

      botEvents.emit(EVENTS.STOP_LOSS_TRIGGERED, {
        entryPrice: this.entryPrice,
        exitPrice: currentPrice,
        highestPrice: this.highestPrice,
        pnlPercent,
      });

      return true;
    }

    return false;
  }

  /**
   * Retorna estado atual
   */
  getState() {
    return {
      entryPrice: this.entryPrice,
      highestPrice: this.highestPrice,
      stopPrice: this.stopPrice,
      trailingPercent: this.trailingPercent * 100,
      isTriggered: this.isTriggered,
    };
  }
}

/**
 * Gerencia take-profit em níveis
 */
class TakeProfitLevels {
  constructor(entryPrice, levels = null) {
    this.entryPrice = entryPrice;
    this.levels = levels || config.risk.takeProfitLevels.map((level, index) => ({
      ...level,
      targetPrice: entryPrice * (1 + level.percent),
      isTriggered: false,
      levelIndex: index + 1,
    }));
    this.executedLevels = [];
  }

  /**
   * Verifica se algum nível foi atingido
   */
  checkLevels(currentPrice) {
    const triggeredLevels = [];

    for (const level of this.levels) {
      if (!level.isTriggered && currentPrice >= level.targetPrice) {
        level.isTriggered = true;
        this.executedLevels.push(level);

        const pnlPercent = ((currentPrice - this.entryPrice) / this.entryPrice) * 100;

        logger.info(`🎯 TAKE-PROFIT Nível ${level.levelIndex} atingido @ $${currentPrice.toFixed(2)} (+${pnlPercent.toFixed(2)}%)`);
        logger.info(`  Vender ${level.amount * 100}% da posição`);

        botEvents.emit(EVENTS.TAKE_PROFIT_TRIGGERED, {
          level: level.levelIndex,
          entryPrice: this.entryPrice,
          exitPrice: currentPrice,
          percent: level.percent * 100,
          amountToSell: level.amount * 100,
          pnlPercent,
        });

        triggeredLevels.push(level);
      }
    }

    return triggeredLevels;
  }

  /**
   * Verifica se todos os níveis foram executados
   */
  allLevelsExecuted() {
    return this.levels.every(level => level.isTriggered);
  }

  /**
   * Retorna próximo nível não executado
   */
  getNextLevel() {
    return this.levels.find(level => !level.isTriggered) || null;
  }

  /**
   * Retorna estado atual
   */
  getState() {
    return {
      entryPrice: this.entryPrice,
      levels: this.levels.map(l => ({
        levelIndex: l.levelIndex,
        targetPrice: l.targetPrice.toFixed(2),
        percent: `+${(l.percent * 100).toFixed(0)}%`,
        amountToSell: `${(l.amount * 100).toFixed(0)}%`,
        triggered: l.isTriggered,
      })),
      executedCount: this.executedLevels.length,
      totalLevels: this.levels.length,
      allExecuted: this.allLevelsExecuted(),
    };
  }
}

/**
 * Gerenciador completo de exits (combina stop-loss + take-profit)
 */
class ExitManager {
  constructor() {
    this.activeExits = new Map(); // pair -> { stopLoss, takeProfit }
  }

  /**
   * Inicia gerenciamento de exit para uma posição
   */
  startManaging(pair, entryPrice) {
    const stopLoss = new TrailingStopLoss(entryPrice);
    const takeProfit = new TakeProfitLevels(entryPrice);

    this.activeExits.set(pair, {
      stopLoss,
      takeProfit,
      entryPrice,
      startTime: Date.now(),
    });

    logger.info(`🎯 Exit management iniciado para ${pair} @ $${entryPrice.toFixed(2)}`);
    logger.info(`  Stop-loss: $${stopLoss.stopPrice.toFixed(2)} (-${(stopLoss.trailingPercent * 100).toFixed(1)}%)`);
    logger.info(`  Take-profit níveis: ${takeProfit.levels.length}`);
  }

  /**
   * Atualiza com novo preço e verifica condições de saída
   */
  update(pair, currentPrice) {
    const exit = this.activeExits.get(pair);

    if (!exit) {
      return { shouldExit: false, reason: null, partialExit: null };
    }

    // 1. Verifica stop-loss
    const stopTriggered = exit.stopLoss.update(currentPrice);

    if (stopTriggered) {
      return {
        shouldExit: true,
        reason: 'stop_loss',
        exitPrice: currentPrice,
        pnlPercent: ((currentPrice - exit.entryPrice) / exit.entryPrice) * 100,
      };
    }

    // 2. Verifica take-profit levels
    const triggeredLevels = exit.takeProfit.checkLevels(currentPrice);

    if (triggeredLevels.length > 0) {
      // Se todos os níveis foram executados, fecha posição completamente
      if (exit.takeProfit.allLevelsExecuted()) {
        return {
          shouldExit: true,
          reason: 'all_take_profit_levels',
          exitPrice: currentPrice,
          pnlPercent: ((currentPrice - exit.entryPrice) / exit.entryPrice) * 100,
        };
      }

      // Saída parcial
      return {
        shouldExit: false,
        partialExit: triggeredLevels.map(level => ({
          levelIndex: level.levelIndex,
          amountPercent: level.amount,
          targetPrice: level.targetPrice,
          currentPrice,
        })),
      };
    }

    return { shouldExit: false, reason: null, partialExit: null };
  }

  /**
   * Para gerenciamento de exit para um par
   */
  stopManaging(pair) {
    if (this.activeExits.has(pair)) {
      this.activeExits.delete(pair);
      logger.info(`Exit management parado para ${pair}`);
    }
  }

  /**
   * Verifica se está gerenciando um par
   */
  isManaging(pair) {
    return this.activeExits.has(pair);
  }

  /**
   * Retorna estado do exit management para um par
   */
  getExitState(pair) {
    const exit = this.activeExits.get(pair);

    if (!exit) {
      return null;
    }

    return {
      pair,
      entryPrice: exit.entryPrice,
      elapsedTime: Math.floor((Date.now() - exit.startTime) / 1000),
      stopLoss: exit.stopLoss.getState(),
      takeProfit: exit.takeProfit.getState(),
    };
  }

  /**
   * Retorna todos os exits ativos
   */
  getAllActiveExits() {
    const states = [];

    for (const [pair, _] of this.activeExits) {
      states.push(this.getExitState(pair));
    }

    return states;
  }

  /**
   * Reseta exit manager
   */
  reset() {
    this.activeExits.clear();
    logger.info('Exit Manager resetado');
  }
}

// Singleton instance
const exitManager = new ExitManager();

module.exports = {
  exitManager,
  ExitManager,
  TrailingStopLoss,
  TakeProfitLevels,
};
