/**
 * Base Strategy Class - Jason Bot Trader
 * Versão: 0.2.0
 *
 * Classe abstrata base para todas as estratégias de trading
 * Fornece interface comum e métodos compartilhados
 */

const { logger } = require('../reporting/logger');
const { botEvents, EVENTS } = require('../core/events');

/**
 * Classe base abstrata para estratégias
 */
class BaseStrategy {
  constructor(name, config = {}) {
    if (new.target === BaseStrategy) {
      throw new Error('BaseStrategy é uma classe abstrata e não pode ser instanciada diretamente');
    }

    this.name = name;
    this.config = config;
    this.isActive = false;
    this.currentPosition = null;
    this.trades = [];
    this.metrics = {
      totalSignals: 0,
      executedTrades: 0,
      successRate: 0,
    };
  }

  /**
   * Método abstrato: Analisa mercado e retorna sinal de trade
   * Deve ser implementado por cada estratégia
   *
   * @param {Object} marketData - Dados de mercado atuais
   * @returns {Object|null} - { action: 'buy'|'sell', confidence: 0-1, reason: string } ou null
   */
  async analyze(marketData) {
    throw new Error('Método analyze() deve ser implementado pela estratégia');
  }

  /**
   * Método abstrato: Valida se estratégia pode ser usada no mercado atual
   *
   * @param {Object} marketData - Dados de mercado
   * @returns {Boolean}
   */
  canTrade(marketData) {
    throw new Error('Método canTrade() deve ser implementado pela estratégia');
  }

  /**
   * Ativa a estratégia
   */
  activate() {
    this.isActive = true;
    logger.info(`📊 Estratégia ${this.name} ativada`);
    botEvents.emit(EVENTS.STRATEGY_SELECTED, {
      strategy: this.name,
      config: this.config,
    });
  }

  /**
   * Desativa a estratégia
   */
  deactivate() {
    this.isActive = false;
    logger.info(`🛑 Estratégia ${this.name} desativada`);
  }

  /**
   * Verifica se estratégia está ativa
   */
  isStrategyActive() {
    return this.isActive;
  }

  /**
   * Registra um sinal de trading
   */
  recordSignal(signal) {
    this.metrics.totalSignals++;
    logger.debug(`Sinal gerado [${this.name}]:`, signal);
  }

  /**
   * Registra execução de trade
   */
  recordTrade(trade) {
    this.trades.push({
      ...trade,
      strategy: this.name,
      timestamp: new Date().toISOString(),
    });
    this.metrics.executedTrades++;

    // Atualiza taxa de sucesso
    const successfulTrades = this.trades.filter(t => t.pnl > 0).length;
    this.metrics.successRate = this.trades.length > 0
      ? (successfulTrades / this.trades.length) * 100
      : 0;

    logger.info(`Trade registrado [${this.name}]:`, {
      side: trade.side,
      pnl: trade.pnl,
      successRate: this.metrics.successRate.toFixed(2) + '%',
    });
  }

  /**
   * Atualiza posição atual
   */
  updatePosition(position) {
    this.currentPosition = position;
    logger.debug(`Posição atualizada [${this.name}]:`, position);
  }

  /**
   * Limpa posição atual
   */
  clearPosition() {
    this.currentPosition = null;
    logger.debug(`Posição fechada [${this.name}]`);
  }

  /**
   * Retorna posição atual
   */
  getPosition() {
    return this.currentPosition;
  }

  /**
   * Verifica se tem posição aberta
   */
  hasOpenPosition() {
    return this.currentPosition !== null;
  }

  /**
   * Retorna métricas da estratégia
   */
  getMetrics() {
    return {
      name: this.name,
      ...this.metrics,
      totalTrades: this.trades.length,
      avgPnL: this.calculateAveragePnL(),
    };
  }

  /**
   * Calcula P&L médio dos trades
   */
  calculateAveragePnL() {
    if (this.trades.length === 0) return 0;

    const totalPnL = this.trades.reduce((sum, trade) => sum + (trade.pnl || 0), 0);
    return totalPnL / this.trades.length;
  }

  /**
   * Reseta métricas da estratégia
   */
  resetMetrics() {
    this.metrics = {
      totalSignals: 0,
      executedTrades: 0,
      successRate: 0,
    };
    this.trades = [];
    logger.info(`Métricas resetadas [${this.name}]`);
  }

  /**
   * Retorna configuração da estratégia
   */
  getConfig() {
    return { ...this.config };
  }

  /**
   * Atualiza configuração da estratégia
   */
  updateConfig(newConfig) {
    this.config = { ...this.config, ...newConfig };
    logger.info(`Configuração atualizada [${this.name}]:`, newConfig);
  }

  /**
   * Valida dados de mercado mínimos necessários
   */
  validateMarketData(marketData) {
    const required = ['price', 'volume', 'liquidity', 'timestamp'];
    const missing = required.filter(field => !marketData[field]);

    if (missing.length > 0) {
      logger.warn(`Dados de mercado incompletos [${this.name}]. Faltando: ${missing.join(', ')}`);
      return false;
    }

    return true;
  }

  /**
   * Helper: Calcula variação percentual
   */
  calculatePriceChange(currentPrice, previousPrice) {
    if (!previousPrice || previousPrice === 0) return 0;
    return ((currentPrice - previousPrice) / previousPrice) * 100;
  }

  /**
   * Helper: Calcula volatilidade (desvio padrão de preços)
   */
  calculateVolatility(prices) {
    if (!prices || prices.length < 2) return 0;

    const mean = prices.reduce((sum, p) => sum + p, 0) / prices.length;
    const squaredDiffs = prices.map(p => Math.pow(p - mean, 2));
    const variance = squaredDiffs.reduce((sum, d) => sum + d, 0) / prices.length;

    return Math.sqrt(variance);
  }

  /**
   * Retorna descrição da estratégia
   */
  toString() {
    return `${this.name} Strategy (Active: ${this.isActive}, Trades: ${this.trades.length})`;
  }
}

module.exports = BaseStrategy;
