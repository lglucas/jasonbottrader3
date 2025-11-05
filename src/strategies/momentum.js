/**
 * Momentum Trading Strategy - Jason Bot Trader
 * Versão: 0.2.0
 *
 * Estratégia que identifica movimentos fortes de preço e volume
 * Entra na direção da tendência forte
 */

const BaseStrategy = require('./base');
const { calculateRSI, isRSIBuySignal, isRSISellSignal } = require('../indicators/rsi');
const { calculateEMA } = require('../indicators/ema');
const { logger } = require('../reporting/logger');
const { config } = require('../core/config');

/**
 * Estratégia Momentum Trading
 *
 * Identifica:
 * - Movimentos rápidos de preço (entry/exit threshold)
 * - Volume acima da média
 * - RSI para evitar entrar em sobrecompra/sobrevenda
 */
class MomentumStrategy extends BaseStrategy {
  constructor(customConfig = {}) {
    const defaultConfig = {
      ...config.strategies.momentum,
      ...customConfig,
    };

    super('Momentum', defaultConfig);

    this.priceHistory = [];
    this.volumeHistory = [];
    this.entryPrice = null;
    this.highestPrice = null;
  }

  /**
   * Adiciona dados históricos
   */
  updateHistory(marketData) {
    this.priceHistory.push(marketData.price);
    this.volumeHistory.push(marketData.volume);

    // Limita histórico ao lookback period
    const maxHistory = this.config.lookbackPeriod + 10;

    if (this.priceHistory.length > maxHistory) {
      this.priceHistory.shift();
    }

    if (this.volumeHistory.length > maxHistory) {
      this.volumeHistory.shift();
    }
  }

  /**
   * Verifica se pode operar (mercado com tendência)
   */
  canTrade(marketData) {
    if (!this.validateMarketData(marketData)) {
      return false;
    }

    // Momentum funciona melhor com alta volatilidade
    if (marketData.volatility && marketData.volatility < 0.05) {
      logger.debug('[Momentum] Volatilidade baixa, não recomendado');
      return false;
    }

    // Precisa de volume mínimo
    if (marketData.volume < config.analysis.minVolume24h) {
      logger.debug('[Momentum] Volume insuficiente');
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

    // Atualiza histórico
    this.updateHistory(marketData);

    // Precisa de dados históricos suficientes
    if (this.priceHistory.length < this.config.lookbackPeriod) {
      logger.debug('[Momentum] Coletando dados históricos...');
      return null;
    }

    const currentPrice = marketData.price;
    const currentVolume = marketData.volume;

    // Calcula indicadores
    const rsi = calculateRSI(this.priceHistory, 14);
    const avgVolume = this.calculateAverageVolume();
    const priceChange = this.calculateRecentPriceChange();

    // Verifica volume acima da média
    const isHighVolume = currentVolume > (avgVolume * this.config.volumeMultiplier);

    // Se não tem posição, procura entrada
    if (!this.hasOpenPosition()) {
      return this.findEntrySignal(currentPrice, priceChange, rsi, isHighVolume, marketData);
    }

    // Se tem posição, procura saída
    return this.findExitSignal(currentPrice, priceChange, rsi);
  }

  /**
   * Procura sinal de entrada
   */
  findEntrySignal(currentPrice, priceChange, rsi, isHighVolume, marketData) {
    const { entryThreshold, rsiEntry } = this.config;

    // Condições para entrada:
    // 1. Preço subiu mais que threshold (ex: 5% em lookback period)
    // 2. Volume alto (2x a média)
    // 3. RSI não está sobrecomprado (< 70)

    if (priceChange > entryThreshold && isHighVolume && rsi < rsiEntry + 40) {
      const signal = {
        action: 'buy',
        confidence: 0.85,
        reason: `Momentum forte: +${(priceChange * 100).toFixed(2)}%, Volume ${isHighVolume ? 'alto' : 'normal'}, RSI ${rsi.toFixed(1)}`,
        price: currentPrice,
        rsi: rsi,
        priceChange: priceChange,
        volume: marketData.volume,
      };

      this.entryPrice = currentPrice;
      this.highestPrice = currentPrice;

      this.recordSignal(signal);

      logger.info(`📈 Sinal de COMPRA [Momentum]: Preço $${currentPrice.toFixed(2)}, RSI ${rsi.toFixed(1)}`);

      return signal;
    }

    return null;
  }

  /**
   * Procura sinal de saída
   */
  findExitSignal(currentPrice, priceChange, rsi) {
    const { exitThreshold, rsiExit } = this.config;

    // Atualiza maior preço atingido
    if (currentPrice > this.highestPrice) {
      this.highestPrice = currentPrice;
    }

    // Calcula queda desde o pico
    const dropFromPeak = (this.highestPrice - currentPrice) / this.highestPrice;

    // Condições para saída:
    // 1. Preço caiu mais que exitThreshold desde o pico (ex: -3%)
    // OU
    // 2. RSI ficou sobrecomprado (> 70)

    if (dropFromPeak > exitThreshold || rsi > rsiExit) {
      const pnl = ((currentPrice - this.entryPrice) / this.entryPrice) * 100;

      const signal = {
        action: 'sell',
        confidence: 0.85,
        reason: dropFromPeak > exitThreshold
          ? `Queda de ${(dropFromPeak * 100).toFixed(2)}% desde pico $${this.highestPrice.toFixed(2)}`
          : `RSI sobrecomprado: ${rsi.toFixed(1)}`,
        price: currentPrice,
        rsi: rsi,
        pnl: pnl,
      };

      this.recordSignal(signal);

      logger.info(`📉 Sinal de VENDA [Momentum]: Preço $${currentPrice.toFixed(2)}, P&L ${pnl.toFixed(2)}%`);

      // Reseta rastreamento
      this.entryPrice = null;
      this.highestPrice = null;

      return signal;
    }

    return null;
  }

  /**
   * Calcula mudança de preço recente (lookback period)
   */
  calculateRecentPriceChange() {
    if (this.priceHistory.length < this.config.lookbackPeriod) {
      return 0;
    }

    const recentPrices = this.priceHistory.slice(-this.config.lookbackPeriod);
    const oldestPrice = recentPrices[0];
    const latestPrice = recentPrices[recentPrices.length - 1];

    return (latestPrice - oldestPrice) / oldestPrice;
  }

  /**
   * Calcula volume médio
   */
  calculateAverageVolume() {
    if (this.volumeHistory.length === 0) {
      return 0;
    }

    const sum = this.volumeHistory.reduce((acc, vol) => acc + vol, 0);
    return sum / this.volumeHistory.length;
  }

  /**
   * Retorna estado atual do momentum
   */
  getMomentumState() {
    const rsi = calculateRSI(this.priceHistory, 14);
    const avgVolume = this.calculateAverageVolume();
    const priceChange = this.calculateRecentPriceChange();

    return {
      priceHistory: this.priceHistory.slice(-10).map(p => p.toFixed(2)),
      currentRSI: rsi ? rsi.toFixed(1) : null,
      avgVolume: avgVolume.toFixed(0),
      recentPriceChange: (priceChange * 100).toFixed(2) + '%',
      entryPrice: this.entryPrice?.toFixed(2) || null,
      highestPrice: this.highestPrice?.toFixed(2) || null,
      hasPosition: this.hasOpenPosition(),
    };
  }

  /**
   * Reseta histórico
   */
  reset() {
    this.priceHistory = [];
    this.volumeHistory = [];
    this.entryPrice = null;
    this.highestPrice = null;
    this.resetMetrics();
    logger.info('Momentum resetado');
  }

  /**
   * Override: Descrição específica do momentum
   */
  toString() {
    const rsi = calculateRSI(this.priceHistory, 14);
    return `Momentum Strategy (RSI: ${rsi ? rsi.toFixed(1) : 'N/A'}, Position: ${this.hasOpenPosition()}, Active: ${this.isActive})`;
  }
}

module.exports = MomentumStrategy;
