/**
 * RSI (Relative Strength Index) - Jason Bot Trader
 * Versão: 0.2.0
 *
 * Indicador de força relativa
 * RSI < 30 = Sobrevendido (possível oportunidade de compra)
 * RSI > 70 = Sobrecomprado (possível oportunidade de venda)
 */

/**
 * Calcula RSI (Relative Strength Index)
 *
 * @param {Array<Number>} prices - Array de preços (mais recente no final)
 * @param {Number} period - Período do RSI (padrão: 14)
 * @returns {Number} - Valor do RSI (0-100)
 */
function calculateRSI(prices, period = 14) {
  if (!prices || prices.length < period + 1) {
    return null; // Dados insuficientes
  }

  // Calcula mudanças de preço
  const changes = [];
  for (let i = 1; i < prices.length; i++) {
    changes.push(prices[i] - prices[i - 1]);
  }

  // Separa ganhos e perdas
  const gains = changes.map(change => change > 0 ? change : 0);
  const losses = changes.map(change => change < 0 ? Math.abs(change) : 0);

  // Calcula média dos últimos 'period' ganhos/perdas
  const recentGains = gains.slice(-period);
  const recentLosses = losses.slice(-period);

  const avgGain = recentGains.reduce((sum, val) => sum + val, 0) / period;
  const avgLoss = recentLosses.reduce((sum, val) => sum + val, 0) / period;

  // Evita divisão por zero
  if (avgLoss === 0) {
    return 100;
  }

  // Calcula RS e RSI
  const rs = avgGain / avgLoss;
  const rsi = 100 - (100 / (1 + rs));

  return rsi;
}

/**
 * Interpreta valor do RSI
 *
 * @param {Number} rsi - Valor do RSI
 * @returns {String} - 'overbought', 'oversold', 'neutral'
 */
function interpretRSI(rsi) {
  if (rsi === null) return 'insufficient_data';
  if (rsi > 70) return 'overbought'; // Sobrecomprado
  if (rsi < 30) return 'oversold'; // Sobrevendido
  return 'neutral';
}

/**
 * Verifica se RSI indica sinal de compra
 */
function isRSIBuySignal(rsi, threshold = 30) {
  return rsi !== null && rsi < threshold;
}

/**
 * Verifica se RSI indica sinal de venda
 */
function isRSISellSignal(rsi, threshold = 70) {
  return rsi !== null && rsi > threshold;
}

module.exports = {
  calculateRSI,
  interpretRSI,
  isRSIBuySignal,
  isRSISellSignal,
};
