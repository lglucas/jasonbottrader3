/**
 * EMA (Exponential Moving Average) - Jason Bot Trader
 * Versão: 0.2.0
 *
 * Média móvel exponencial que dá mais peso aos preços recentes
 * Usado para identificar tendências
 */

/**
 * Calcula EMA (Exponential Moving Average)
 *
 * @param {Array<Number>} prices - Array de preços (mais recente no final)
 * @param {Number} period - Período da EMA (padrão: 9)
 * @returns {Number} - Valor da EMA
 */
function calculateEMA(prices, period = 9) {
  if (!prices || prices.length < period) {
    return null; // Dados insuficientes
  }

  // Calcula multiplicador
  const multiplier = 2 / (period + 1);

  // Primeira EMA é uma SMA (média simples)
  const firstPrices = prices.slice(0, period);
  let ema = firstPrices.reduce((sum, price) => sum + price, 0) / period;

  // Calcula EMA para os preços restantes
  for (let i = period; i < prices.length; i++) {
    ema = (prices[i] - ema) * multiplier + ema;
  }

  return ema;
}

/**
 * Calcula múltiplas EMAs de uma vez
 *
 * @param {Array<Number>} prices - Array de preços
 * @param {Array<Number>} periods - Array de períodos [9, 21, 50]
 * @returns {Object} - { ema9, ema21, ema50, ... }
 */
function calculateMultipleEMAs(prices, periods = [9, 21, 50]) {
  const result = {};

  for (const period of periods) {
    const ema = calculateEMA(prices, period);
    result[`ema${period}`] = ema;
  }

  return result;
}

/**
 * Detecta cruzamento de EMA (crossover)
 *
 * @param {Array<Number>} prices - Preços históricos
 * @param {Number} fastPeriod - Período da EMA rápida (ex: 9)
 * @param {Number} slowPeriod - Período da EMA lenta (ex: 21)
 * @returns {String|null} - 'bullish' (alta), 'bearish' (baixa), null
 */
function detectEMACrossover(prices, fastPeriod = 9, slowPeriod = 21) {
  if (!prices || prices.length < slowPeriod + 2) {
    return null;
  }

  // Calcula EMAs atuais
  const currentFastEMA = calculateEMA(prices, fastPeriod);
  const currentSlowEMA = calculateEMA(prices, slowPeriod);

  // Calcula EMAs anteriores (sem o último preço)
  const previousPrices = prices.slice(0, -1);
  const previousFastEMA = calculateEMA(previousPrices, fastPeriod);
  const previousSlowEMA = calculateEMA(previousPrices, slowPeriod);

  if (!currentFastEMA || !currentSlowEMA || !previousFastEMA || !previousSlowEMA) {
    return null;
  }

  // Detecta cruzamento
  // Bullish: EMA rápida cruza EMA lenta de baixo para cima
  if (previousFastEMA <= previousSlowEMA && currentFastEMA > currentSlowEMA) {
    return 'bullish';
  }

  // Bearish: EMA rápida cruza EMA lenta de cima para baixo
  if (previousFastEMA >= previousSlowEMA && currentFastEMA < currentSlowEMA) {
    return 'bearish';
  }

  return null;
}

/**
 * Verifica se preço está acima da EMA (tendência de alta)
 */
function isPriceAboveEMA(currentPrice, ema) {
  return currentPrice > ema;
}

/**
 * Verifica se preço está abaixo da EMA (tendência de baixa)
 */
function isPriceBelowEMA(currentPrice, ema) {
  return currentPrice < ema;
}

/**
 * Calcula distância percentual entre preço e EMA
 */
function calculateDistanceFromEMA(currentPrice, ema) {
  if (!ema || ema === 0) return null;
  return ((currentPrice - ema) / ema) * 100;
}

module.exports = {
  calculateEMA,
  calculateMultipleEMAs,
  detectEMACrossover,
  isPriceAboveEMA,
  isPriceBelowEMA,
  calculateDistanceFromEMA,
};
