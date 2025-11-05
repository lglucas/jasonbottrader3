/**
 * Testes Unitários - Storage
 */

const fs = require('fs');
const path = require('path');
const { StorageManager } = require('../../src/data/storage');

describe('Storage Manager', () => {
  let storage;
  let testCycleId;

  beforeEach(() => {
    storage = new StorageManager();
  });

  afterEach(() => {
    // Limpa ciclo de teste se existir
    if (testCycleId && storage.currentCycleFile && fs.existsSync(storage.currentCycleFile)) {
      fs.unlinkSync(storage.currentCycleFile);
    }
  });

  test('deve criar diretórios necessários', () => {
    expect(fs.existsSync(storage.dataDir)).toBe(true);
    expect(fs.existsSync(storage.cyclesDir)).toBe(true);
    expect(fs.existsSync(storage.marketDir)).toBe(true);
  });

  test('deve iniciar novo ciclo corretamente', () => {
    const cycle = storage.startNewCycle('arbitrum', 'grid');
    testCycleId = cycle.cycleId;

    expect(cycle).toBeDefined();
    expect(cycle.cycleId).toMatch(/^cycle-\d{4}-\d{2}-\d{2}/);
    expect(cycle.network).toBe('arbitrum');
    expect(cycle.strategy).toBe('grid');
    expect(cycle.trades).toEqual([]);
    expect(cycle.totalTrades).toBe(0);
  });

  test('deve adicionar trade ao ciclo', () => {
    const cycle = storage.startNewCycle('arbitrum', 'grid');
    testCycleId = cycle.cycleId;

    const trade = {
      timestamp: new Date().toISOString(),
      side: 'buy',
      pair: 'WETH/USDC',
      amountIn: '0.001',
      amountOut: '2.5',
      pnl: null,
    };

    storage.addTrade(trade);

    expect(storage.currentCycle.trades).toHaveLength(1);
    expect(storage.currentCycle.totalTrades).toBe(1);
  });

  test('deve finalizar ciclo corretamente', () => {
    const cycle = storage.startNewCycle('arbitrum', 'grid');
    testCycleId = cycle.cycleId;

    // Adiciona alguns trades
    storage.addTrade({
      side: 'buy',
      pnl: null,
    });

    storage.addTrade({
      side: 'sell',
      pnl: 5,
    });

    const finalized = storage.finalizeCycle();

    expect(finalized).toBeDefined();
    expect(finalized.endTime).toBeDefined();
    expect(finalized.durationSeconds).toBeGreaterThan(0);
    expect(finalized.pnl).toBeDefined();
  });

  test('deve calcular win rate corretamente', () => {
    const cycle = storage.startNewCycle('arbitrum', 'grid');
    testCycleId = cycle.cycleId;

    // 3 trades vencedores, 2 perdedores
    storage.addTrade({ side: 'sell', pnl: 5 });
    storage.addTrade({ side: 'sell', pnl: -3 });
    storage.addTrade({ side: 'sell', pnl: 8 });
    storage.addTrade({ side: 'sell', pnl: -2 });
    storage.addTrade({ side: 'sell', pnl: 4 });

    const finalized = storage.finalizeCycle();

    expect(finalized.winningTrades).toBe(3);
    expect(finalized.losingTrades).toBe(2);
    expect(finalized.winRate).toBe(60);
  });

  test('deve listar ciclos salvos', () => {
    const cycle = storage.startNewCycle('arbitrum', 'grid');
    testCycleId = cycle.cycleId;

    storage.finalizeCycle();

    const cycles = storage.listCycles();

    expect(Array.isArray(cycles)).toBe(true);
    expect(cycles.length).toBeGreaterThan(0);
  });

  test('deve salvar dados de mercado em JSONL', () => {
    const network = 'arbitrum';
    const pair = 'WETH/USDC';
    const data = {
      price: 2500,
      volume: 100000,
      liquidity: 500000,
    };

    storage.saveMarketData(network, pair, data);

    const date = new Date().toISOString().slice(0, 10);
    const filePath = path.join(
      storage.marketDir,
      network,
      date,
      `${pair.replace('/', '-')}.jsonl`
    );

    expect(fs.existsSync(filePath)).toBe(true);

    // Limpa arquivo de teste
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
  });
});
