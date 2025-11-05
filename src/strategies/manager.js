/**
 * Strategy Manager - Jason Bot Trader
 * Versão: 0.2.0
 *
 * Gerencia e seleciona dinamicamente entre estratégias
 * - Grid Trading: mercados laterais (baixa volatilidade)
 * - Momentum: mercados com tendência (alta volatilidade + volume)
 */

const GridTradingStrategy = require('./grid-trading');
const MomentumStrategy = require('./momentum');
const { logger } = require('../reporting/logger');
const { config } = require('../core/config');
const { botEvents, EVENTS } = require('../core/events');

/**
 * Gerenciador de estratégias
 */
class StrategyManager {
  constructor() {
    this.strategies = {
      grid: new GridTradingStrategy(),
      momentum: new MomentumStrategy(),
    };

    this.currentStrategy = null;
    this.defaultStrategy = config.strategies.default;
    this.lastSwitch = null;
    this.switchCooldown = 300000; // 5 minutos entre trocas
  }

  /**
   * Inicializa strategy manager
   */
  async initialize() {
    logger.info('🎯 Inicializando Strategy Manager...');

    // Ativa estratégia padrão
    if (this.defaultStrategy === 'auto') {
      logger.info('Modo AUTO: Seleção dinâmica de estratégia ativada');
    } else {
      this.selectStrategy(this.defaultStrategy, { reason: 'default' });
    }
  }

  /**
   * Seleciona estratégia dinamicamente baseada em market data
   */
  async autoSelectStrategy(marketData) {
    // Calcula métricas do mercado
    const volatility = marketData.volatility || 0;
    const volumeRatio = marketData.volume / (marketData.avgVolume || marketData.volume);
    const trend = this.detectTrend(marketData.priceHistory || []);

    logger.debug(`Market analysis: Vol ${(volatility * 100).toFixed(1)}%, VolumeRatio ${volumeRatio.toFixed(2)}x, Trend ${trend}`);

    // Critérios de decisão:
    // Momentum: Alta volatilidade (>15%) + Volume alto (>1.5x) + Tendência clara
    // Grid: Baixa/média volatilidade + Mercado lateral

    let selectedStrategy = 'grid'; // Padrão conservador

    if (volatility > 0.15 && volumeRatio > 1.5 && trend !== 'sideways') {
      selectedStrategy = 'momentum';
    }

    // Troca estratégia se necessário
    if (!this.currentStrategy || this.currentStrategy.name !== selectedStrategy.charAt(0).toUpperCase() + selectedStrategy.slice(1)) {
      this.selectStrategy(selectedStrategy, {
        reason: 'market_conditions',
        volatility,
        volumeRatio,
        trend,
      });
    }
  }

  /**
   * Seleciona uma estratégia específica
   */
  selectStrategy(strategyName, metadata = {}) {
    // Verifica cooldown
    if (this.lastSwitch && (Date.now() - this.lastSwitch < this.switchCooldown)) {
      logger.debug('Strategy switch em cooldown');
      return false;
    }

    const strategy = this.strategies[strategyName];

    if (!strategy) {
      logger.error(`Estratégia inválida: ${strategyName}`);
      return false;
    }

    // Desativa estratégia anterior
    if (this.currentStrategy) {
      this.currentStrategy.deactivate();
    }

    // Ativa nova estratégia
    this.currentStrategy = strategy;
    this.currentStrategy.activate();
    this.lastSwitch = Date.now();

    logger.info(`✅ Estratégia selecionada: ${this.currentStrategy.name}`);
    if (metadata.reason) {
      logger.info(`  Razão: ${metadata.reason}`);
    }

    botEvents.emit(EVENTS.STRATEGY_SELECTED, {
      strategy: strategyName,
      ...metadata,
    });

    return true;
  }

  /**
   * Analisa mercado com estratégia atual
   */
  async analyze(marketData) {
    // Se em modo auto, seleciona estratégia dinamicamente
    if (this.defaultStrategy === 'auto') {
      await this.autoSelectStrategy(marketData);
    }

    if (!this.currentStrategy) {
      logger.warn('Nenhuma estratégia ativa');
      return null;
    }

    // Verifica se estratégia pode operar
    if (!this.currentStrategy.canTrade(marketData)) {
      logger.debug(`Estratégia ${this.currentStrategy.name} não pode operar neste mercado`);
      return null;
    }

    // Executa análise
    return await this.currentStrategy.analyze(marketData);
  }

  /**
   * Detecta tendência do mercado
   */
  detectTrend(priceHistory) {
    if (!priceHistory || priceHistory.length < 10) {
      return 'insufficient_data';
    }

    const recent = priceHistory.slice(-10);
    const older = priceHistory.slice(-20, -10);

    if (older.length === 0) {
      return 'insufficient_data';
    }

    const avgRecent = recent.reduce((sum, p) => sum + p, 0) / recent.length;
    const avgOlder = older.reduce((sum, p) => sum + p, 0) / older.length;

    const diff = (avgRecent - avgOlder) / avgOlder;

    if (diff > 0.05) return 'uptrend'; // +5% = tendência de alta
    if (diff < -0.05) return 'downtrend'; // -5% = tendência de baixa
    return 'sideways'; // mercado lateral
  }

  /**
   * Força troca de estratégia (ex: após drawdown)
   */
  forceSwitch(strategyName, reason = 'manual') {
    // Remove cooldown temporariamente
    const originalSwitch = this.lastSwitch;
    this.lastSwitch = null;

    const success = this.selectStrategy(strategyName, { reason });

    if (!success) {
      this.lastSwitch = originalSwitch;
    }

    return success;
  }

  /**
   * Retorna estratégia ativa
   */
  getCurrentStrategy() {
    return this.currentStrategy;
  }

  /**
   * Retorna todas as estratégias disponíveis
   */
  getAllStrategies() {
    return Object.values(this.strategies);
  }

  /**
   * Retorna métricas de todas as estratégias
   */
  getAllMetrics() {
    return Object.keys(this.strategies).reduce((acc, key) => {
      acc[key] = this.strategies[key].getMetrics();
      return acc;
    }, {});
  }

  /**
   * Retorna estado do strategy manager
   */
  getState() {
    return {
      currentStrategy: this.currentStrategy ? this.currentStrategy.name : null,
      defaultMode: this.defaultStrategy,
      lastSwitch: this.lastSwitch ? new Date(this.lastSwitch).toISOString() : null,
      availableStrategies: Object.keys(this.strategies),
      metrics: this.getAllMetrics(),
    };
  }

  /**
   * Reseta todas as estratégias
   */
  reset() {
    Object.values(this.strategies).forEach(strategy => {
      strategy.reset();
      strategy.deactivate();
    });

    this.currentStrategy = null;
    this.lastSwitch = null;

    logger.info('Strategy Manager resetado');
  }
}

// Singleton instance
const strategyManager = new StrategyManager();

module.exports = {
  strategyManager,
  StrategyManager,
};
