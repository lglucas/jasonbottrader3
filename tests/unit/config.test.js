/**
 * Testes Unitários - Config
 */

const { config, validateConfig } = require('../../src/core/config');

describe('Config Manager', () => {
  test('deve carregar configurações corretamente', () => {
    expect(config).toBeDefined();
    expect(config.bot).toBeDefined();
    expect(config.network).toBeDefined();
    expect(config.risk).toBeDefined();
  });

  test('deve ter configurações de bot válidas', () => {
    expect(config.bot.pollingInterval).toBeGreaterThan(0);
    expect(config.bot.initialCapital).toBeGreaterThan(0);
    expect(config.bot.maxPositionPercent).toBeGreaterThan(0);
    expect(config.bot.maxPositionPercent).toBeLessThanOrEqual(0.2); // Max 20%
  });

  test('deve ter configurações de risco válidas', () => {
    expect(config.risk.stopLossTrailing).toBeGreaterThan(0);
    expect(config.risk.maxDrawdown).toBeGreaterThan(0);
    expect(config.risk.maxDrawdown).toBeLessThanOrEqual(0.5); // Max 50%
    expect(config.risk.takeProfitLevels).toHaveLength(3);
  });

  test('deve ter drawdown levels em ordem crescente', () => {
    const levels = config.risk.drawdownLevels;
    expect(levels).toHaveLength(3);
    expect(levels[0].percent).toBeLessThan(levels[1].percent);
    expect(levels[1].percent).toBeLessThan(levels[2].percent);
  });

  test('deve validar configurações sem erros', () => {
    expect(() => validateConfig()).not.toThrow();
  });

  test('deve ter estratégias configuradas', () => {
    expect(config.strategies.default).toBeDefined();
    expect(config.strategies.grid).toBeDefined();
    expect(config.strategies.momentum).toBeDefined();
  });

  test('deve ter critérios de análise válidos', () => {
    expect(config.analysis.minLiquidity).toBeGreaterThan(0);
    expect(config.analysis.minVolume24h).toBeGreaterThan(0);
    expect(config.analysis.minMarketCap).toBeGreaterThan(0);
  });
});
