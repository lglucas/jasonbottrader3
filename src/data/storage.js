/**
 * Storage Manager - Jason Bot Trader
 * Versão: 0.1.0
 *
 * Gerencia persistência de dados em JSON
 * - Ciclos de trading
 * - Trades executados
 * - Métricas de performance
 */

const fs = require('fs');
const path = require('path');
const { config } = require('../core/config');
const { logger } = require('../reporting/logger');

/**
 * Classe para gerenciar storage
 */
class StorageManager {
  constructor() {
    this.dataDir = config.paths.data;
    this.cyclesDir = path.join(this.dataDir, 'cycles');
    this.marketDir = path.join(this.dataDir, 'market');
    this.reportsDir = config.paths.reports;

    this.currentCycle = null;
    this.currentCycleFile = null;

    this.ensureDirectories();
  }

  /**
   * Garante que diretórios existem
   */
  ensureDirectories() {
    const dirs = [
      this.dataDir,
      this.cyclesDir,
      this.marketDir,
      this.reportsDir,
    ];

    dirs.forEach(dir => {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
        logger.debug(`Diretório criado: ${dir}`);
      }
    });
  }

  /**
   * Inicia novo ciclo
   */
  startNewCycle(network, strategy) {
    const timestamp = new Date();
    const cycleId = this.generateCycleId(timestamp);

    this.currentCycle = {
      cycleId,
      startTime: timestamp.toISOString(),
      endTime: null,
      durationSeconds: null,
      network,
      strategy,
      initialCapital: config.bot.initialCapital,
      finalCapital: null,
      pnl: null,
      pnlPercent: null,
      totalTrades: 0,
      winningTrades: 0,
      losingTrades: 0,
      winRate: null,
      maxDrawdown: 0,
      trades: [],
      events: [],
      metrics: {
        avgTradeSize: 0,
        avgProfit: 0,
        avgLoss: 0,
        profitFactor: null,
        sharpeRatio: null,
        maxConsecutiveWins: 0,
        maxConsecutiveLosses: 0,
      },
    };

    this.currentCycleFile = path.join(this.cyclesDir, `${cycleId}.json`);

    this.saveCycle();

    logger.info(`📊 Novo ciclo iniciado: ${cycleId}`);

    return this.currentCycle;
  }

  /**
   * Gera ID único para o ciclo
   * Formato: cycle-YYYY-MM-DD-XXX
   */
  generateCycleId(timestamp) {
    const date = timestamp.toISOString().slice(0, 10); // YYYY-MM-DD
    const time = timestamp.toISOString().slice(11, 19).replace(/:/g, ''); // HHMMSS

    return `cycle-${date}-${time}`;
  }

  /**
   * Adiciona trade ao ciclo atual
   */
  addTrade(trade) {
    if (!this.currentCycle) {
      logger.warn('Nenhum ciclo ativo para adicionar trade');
      return;
    }

    this.currentCycle.trades.push(trade);
    this.currentCycle.totalTrades++;

    // Atualiza contadores
    if (trade.pnl > 0) {
      this.currentCycle.winningTrades++;
    } else if (trade.pnl < 0) {
      this.currentCycle.losingTrades++;
    }

    // Atualiza capital
    if (trade.side === 'sell' && trade.pnl !== null) {
      this.currentCycle.finalCapital = (this.currentCycle.finalCapital || this.currentCycle.initialCapital) + trade.pnl;
    }

    // Salva ciclo
    this.saveCycle();

    logger.debug(`Trade adicionado ao ciclo: ${trade.type}`);
  }

  /**
   * Adiciona evento ao ciclo
   */
  addEvent(eventType, data) {
    if (!this.currentCycle) {
      return;
    }

    this.currentCycle.events.push({
      timestamp: new Date().toISOString(),
      type: eventType,
      data,
    });

    this.saveCycle();
  }

  /**
   * Finaliza ciclo atual
   */
  finalizeCycle() {
    if (!this.currentCycle) {
      logger.warn('Nenhum ciclo ativo para finalizar');
      return null;
    }

    const endTime = new Date();
    const startTime = new Date(this.currentCycle.startTime);

    // Atualiza dados finais
    this.currentCycle.endTime = endTime.toISOString();
    this.currentCycle.durationSeconds = Math.floor((endTime - startTime) / 1000);

    // Calcula capital final se não foi atualizado
    if (!this.currentCycle.finalCapital) {
      this.currentCycle.finalCapital = this.currentCycle.initialCapital;
    }

    // Calcula P&L
    this.currentCycle.pnl = this.currentCycle.finalCapital - this.currentCycle.initialCapital;
    this.currentCycle.pnlPercent = (this.currentCycle.pnl / this.currentCycle.initialCapital) * 100;

    // Calcula win rate
    if (this.currentCycle.totalTrades > 0) {
      this.currentCycle.winRate = (this.currentCycle.winningTrades / this.currentCycle.totalTrades) * 100;
    }

    // Calcula métricas
    this.calculateMetrics();

    // Salva ciclo final
    this.saveCycle();

    logger.info(`✅ Ciclo finalizado: ${this.currentCycle.cycleId}`);
    logger.info(`  Duration: ${Math.floor(this.currentCycle.durationSeconds / 60)} min`);
    logger.info(`  P&L: $${this.currentCycle.pnl.toFixed(2)} (${this.currentCycle.pnlPercent.toFixed(2)}%)`);
    logger.info(`  Trades: ${this.currentCycle.totalTrades} (Win Rate: ${this.currentCycle.winRate?.toFixed(2)}%)`);

    const finalized = { ...this.currentCycle };

    // Limpa ciclo atual
    this.currentCycle = null;
    this.currentCycleFile = null;

    return finalized;
  }

  /**
   * Calcula métricas do ciclo
   */
  calculateMetrics() {
    if (!this.currentCycle || this.currentCycle.trades.length === 0) {
      return;
    }

    const trades = this.currentCycle.trades.filter(t => t.pnl !== null);

    if (trades.length === 0) {
      return;
    }

    // Tamanho médio de trade
    this.currentCycle.metrics.avgTradeSize = trades.reduce((sum, t) => sum + (t.amountInUSD || 0), 0) / trades.length;

    // Lucro e prejuízo médios
    const profits = trades.filter(t => t.pnl > 0);
    const losses = trades.filter(t => t.pnl < 0);

    if (profits.length > 0) {
      this.currentCycle.metrics.avgProfit = profits.reduce((sum, t) => sum + t.pnl, 0) / profits.length;
    }

    if (losses.length > 0) {
      this.currentCycle.metrics.avgLoss = Math.abs(losses.reduce((sum, t) => sum + t.pnl, 0) / losses.length);
    }

    // Profit Factor
    const totalProfit = profits.reduce((sum, t) => sum + t.pnl, 0);
    const totalLoss = Math.abs(losses.reduce((sum, t) => sum + t.pnl, 0));

    if (totalLoss > 0) {
      this.currentCycle.metrics.profitFactor = totalProfit / totalLoss;
    }

    // Max consecutive wins/losses
    let consecutiveWins = 0;
    let consecutiveLosses = 0;
    let maxWins = 0;
    let maxLosses = 0;

    trades.forEach(trade => {
      if (trade.pnl > 0) {
        consecutiveWins++;
        consecutiveLosses = 0;
        maxWins = Math.max(maxWins, consecutiveWins);
      } else if (trade.pnl < 0) {
        consecutiveLosses++;
        consecutiveWins = 0;
        maxLosses = Math.max(maxLosses, consecutiveLosses);
      }
    });

    this.currentCycle.metrics.maxConsecutiveWins = maxWins;
    this.currentCycle.metrics.maxConsecutiveLosses = maxLosses;
  }

  /**
   * Salva ciclo atual no arquivo
   */
  saveCycle() {
    if (!this.currentCycle || !this.currentCycleFile) {
      return;
    }

    try {
      fs.writeFileSync(
        this.currentCycleFile,
        JSON.stringify(this.currentCycle, null, 2),
        'utf8'
      );

      logger.debug(`Ciclo salvo: ${this.currentCycleFile}`);
    } catch (error) {
      logger.error('Erro ao salvar ciclo:', error);
    }
  }

  /**
   * Carrega ciclo de um arquivo
   */
  loadCycle(cycleId) {
    try {
      const filePath = path.join(this.cyclesDir, `${cycleId}.json`);

      if (!fs.existsSync(filePath)) {
        logger.warn(`Ciclo não encontrado: ${cycleId}`);
        return null;
      }

      const data = fs.readFileSync(filePath, 'utf8');
      return JSON.parse(data);
    } catch (error) {
      logger.error(`Erro ao carregar ciclo ${cycleId}:`, error);
      return null;
    }
  }

  /**
   * Lista todos os ciclos salvos
   */
  listCycles() {
    try {
      const files = fs.readdirSync(this.cyclesDir);
      const cycles = files
        .filter(file => file.startsWith('cycle-') && file.endsWith('.json'))
        .map(file => {
          const cycleId = file.replace('.json', '');
          const filePath = path.join(this.cyclesDir, file);
          const stats = fs.statSync(filePath);

          // Lê dados básicos
          const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));

          return {
            cycleId,
            startTime: data.startTime,
            endTime: data.endTime,
            pnl: data.pnl,
            totalTrades: data.totalTrades,
            winRate: data.winRate,
            fileSize: stats.size,
            lastModified: stats.mtime,
          };
        })
        .sort((a, b) => new Date(b.startTime) - new Date(a.startTime));

      return cycles;
    } catch (error) {
      logger.error('Erro ao listar ciclos:', error);
      return [];
    }
  }

  /**
   * Remove ciclos antigos (rotação)
   */
  rotateCycles() {
    const retentionDays = config.retention.data;
    const now = Date.now();
    const maxAge = retentionDays * 24 * 60 * 60 * 1000;

    try {
      const files = fs.readdirSync(this.cyclesDir);
      let removed = 0;

      files.forEach(file => {
        const filePath = path.join(this.cyclesDir, file);
        const stats = fs.statSync(filePath);
        const age = now - stats.mtimeMs;

        if (age > maxAge) {
          fs.unlinkSync(filePath);
          removed++;
          logger.debug(`Ciclo antigo removido: ${file}`);
        }
      });

      if (removed > 0) {
        logger.info(`🗑️  ${removed} ciclo(s) antigo(s) removido(s)`);
      }
    } catch (error) {
      logger.error('Erro ao rotacionar ciclos:', error);
    }
  }

  /**
   * Salva dados de mercado (preços, liquidez, etc)
   */
  saveMarketData(network, pair, data) {
    try {
      const date = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
      const networkDir = path.join(this.marketDir, network);
      const dateDir = path.join(networkDir, date);

      // Cria diretórios se não existirem
      if (!fs.existsSync(dateDir)) {
        fs.mkdirSync(dateDir, { recursive: true });
      }

      const filename = `${pair.replace('/', '-')}.jsonl`;
      const filePath = path.join(dateDir, filename);

      // Adiciona timestamp
      const record = {
        timestamp: new Date().toISOString(),
        ...data,
      };

      // Append JSONL (um JSON por linha)
      fs.appendFileSync(filePath, JSON.stringify(record) + '\n', 'utf8');

      logger.debug(`Dados de mercado salvos: ${network}/${pair}`);
    } catch (error) {
      logger.error('Erro ao salvar dados de mercado:', error);
    }
  }

  /**
   * Lê dados de mercado de um dia específico
   */
  loadMarketData(network, pair, date) {
    try {
      const filename = `${pair.replace('/', '-')}.jsonl`;
      const filePath = path.join(this.marketDir, network, date, filename);

      if (!fs.existsSync(filePath)) {
        return [];
      }

      const content = fs.readFileSync(filePath, 'utf8');
      const lines = content.trim().split('\n');

      return lines.map(line => JSON.parse(line));
    } catch (error) {
      logger.error(`Erro ao carregar dados de mercado ${network}/${pair}:`, error);
      return [];
    }
  }
}

// Singleton instance
const storageManager = new StorageManager();

module.exports = {
  storageManager,
  StorageManager,
};
