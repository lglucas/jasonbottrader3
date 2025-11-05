/**
 * Drawdown Circuit Breaker - Jason Bot Trader
 * Versão: 0.2.0
 *
 * Sistema de 3 níveis de drawdown com pausas progressivas:
 * - Nível 1 (-5%): Pausa 30min + troca estratégia
 * - Nível 2 (-10%): Pausa 2h + reset parâmetros
 * - Nível 3 (-15%): Para bot completamente
 */

const { config } = require('../core/config');
const { logger } = require('../reporting/logger');
const { botEvents, EVENTS } = require('../core/events');

/**
 * Gerencia drawdown e circuit breaker
 */
class DrawdownManager {
  constructor() {
    this.initialCapital = config.bot.initialCapital;
    this.peakCapital = this.initialCapital;
    this.currentCapital = this.initialCapital;
    this.currentDrawdown = 0;
    this.maxDrawdownReached = 0;

    this.levels = config.risk.drawdownLevels;
    this.triggeredLevels = [];

    this.isPaused = false;
    this.pauseUntil = null;
    this.currentLevel = null;
  }

  /**
   * Atualiza capital e recalcula drawdown
   */
  updateCapital(newCapital) {
    this.currentCapital = newCapital;

    // Atualiza pico se capital aumentou
    if (newCapital > this.peakCapital) {
      this.peakCapital = newCapital;
      logger.debug(`💰 Novo pico de capital: $${this.peakCapital.toFixed(2)}`);
    }

    // Calcula drawdown atual
    this.currentDrawdown = (this.currentCapital - this.peakCapital) / this.peakCapital;

    // Atualiza max drawdown
    if (this.currentDrawdown < this.maxDrawdownReached) {
      this.maxDrawdownReached = this.currentDrawdown;
    }

    // Verifica níveis de drawdown
    this.checkDrawdownLevels();
  }

  /**
   * Verifica se algum nível de drawdown foi atingido
   */
  checkDrawdownLevels() {
    for (let i = 0; i < this.levels.length; i++) {
      const level = this.levels[i];

      // Se drawdown atingiu esse nível e ainda não foi triggered
      if (this.currentDrawdown <= level.percent && !this.triggeredLevels.includes(i)) {
        this.triggerLevel(i, level);
      }
    }
  }

  /**
   * Dispara um nível de drawdown
   */
  triggerLevel(levelIndex, level) {
    this.triggeredLevels.push(levelIndex);
    this.currentLevel = levelIndex + 1;

    const drawdownPercent = Math.abs(this.currentDrawdown * 100);

    logger.error(`🚨 DRAWDOWN NÍVEL ${levelIndex + 1} ATINGIDO: -${drawdownPercent.toFixed(2)}%`);
    logger.error(`  ${level.message}`);
    logger.error(`  Capital: $${this.peakCapital.toFixed(2)} → $${this.currentCapital.toFixed(2)}`);

    // Emite evento específico
    const eventName = {
      0: EVENTS.DRAWDOWN_LEVEL_1,
      1: EVENTS.DRAWDOWN_LEVEL_2,
      2: EVENTS.DRAWDOWN_LEVEL_3,
    }[levelIndex];

    botEvents.emit(eventName, {
      level: levelIndex + 1,
      drawdownPercent,
      peakCapital: this.peakCapital,
      currentCapital: this.currentCapital,
      action: level.action,
      duration: level.duration,
    });

    // Executa ação do nível
    this.executeAction(level);
  }

  /**
   * Executa ação do nível de drawdown
   */
  executeAction(level) {
    switch (level.action) {
      case 'pause':
        this.pauseTrading(level.duration);
        break;

      case 'pause_and_reset':
        this.pauseTrading(level.duration);
        this.resetToConservative();
        break;

      case 'stop':
        this.stopCompletely();
        break;
    }
  }

  /**
   * Pausa trading por X segundos
   */
  pauseTrading(durationSeconds) {
    if (!durationSeconds) return;

    this.isPaused = true;
    this.pauseUntil = Date.now() + (durationSeconds * 1000);

    const minutes = Math.floor(durationSeconds / 60);

    logger.warn(`⏸️  Trading pausado por ${minutes} minutos`);

    // Agenda retomada automática
    setTimeout(() => {
      this.resumeTrading();
    }, durationSeconds * 1000);
  }

  /**
   * Retoma trading
   */
  resumeTrading() {
    if (!this.isPaused) return;

    this.isPaused = false;
    this.pauseUntil = null;

    logger.info(`▶️  Trading retomado após pausa de drawdown`);

    botEvents.emit(EVENTS.BOT_RESUMED, {
      reason: 'drawdown_pause_ended',
    });
  }

  /**
   * Reseta parâmetros para modo conservador
   */
  resetToConservative() {
    logger.warn(`🔄 Resetando para modo CONSERVADOR`);
    logger.warn(`  - Reduzindo tamanho de posição para 5%`);
    logger.warn(`  - Aumentando stop-loss para -2%`);
    logger.warn(`  - Mudando para estratégia Grid (mais conservadora)`);

    // Emite evento para o bot ajustar parâmetros
    botEvents.emit(EVENTS.STRATEGY_CHANGED, {
      reason: 'drawdown_reset',
      newStrategy: 'grid',
      conservative: true,
    });
  }

  /**
   * Para bot completamente
   */
  stopCompletely() {
    logger.error(`🛑 BOT PARADO COMPLETAMENTE por drawdown máximo`);
    logger.error(`  Intervenção manual necessária!`);

    botEvents.emit(EVENTS.BOT_STOPPED, {
      reason: 'max_drawdown',
      drawdown: this.currentDrawdown * 100,
    });
  }

  /**
   * Verifica se trading está pausado
   */
  isTradingPaused() {
    if (!this.isPaused) return false;

    // Se tempo de pausa expirou, retoma automaticamente
    if (Date.now() >= this.pauseUntil) {
      this.resumeTrading();
      return false;
    }

    return true;
  }

  /**
   * Retorna tempo restante de pausa (em segundos)
   */
  getRemainingPauseTime() {
    if (!this.isPaused || !this.pauseUntil) return 0;

    const remaining = Math.max(0, this.pauseUntil - Date.now());
    return Math.floor(remaining / 1000);
  }

  /**
   * Retorna estado atual do drawdown
   */
  getState() {
    return {
      initialCapital: this.initialCapital,
      peakCapital: this.peakCapital,
      currentCapital: this.currentCapital,
      currentDrawdown: this.currentDrawdown * 100,
      maxDrawdownReached: this.maxDrawdownReached * 100,
      currentLevel: this.currentLevel,
      triggeredLevels: this.triggeredLevels.map(i => i + 1),
      isPaused: this.isPaused,
      remainingPauseTime: this.getRemainingPauseTime(),
    };
  }

  /**
   * Reseta drawdown manager
   */
  reset() {
    this.initialCapital = config.bot.initialCapital;
    this.peakCapital = this.initialCapital;
    this.currentCapital = this.initialCapital;
    this.currentDrawdown = 0;
    this.maxDrawdownReached = 0;
    this.triggeredLevels = [];
    this.isPaused = false;
    this.pauseUntil = null;
    this.currentLevel = null;

    logger.info('Drawdown Manager resetado');
  }
}

// Singleton instance
const drawdownManager = new DrawdownManager();

module.exports = {
  drawdownManager,
  DrawdownManager,
};
