/**
 * Bot Principal - Jason Bot Trader
 * Versão: 0.1.0
 *
 * Orquestrador principal do bot
 * Gerencia ciclo de vida, estratégias, trades e reportagens
 */

const { config, printConfigSummary } = require('./config');
const { logger, logEvent, logCriticalError } = require('../reporting/logger');
const { botEvents, EVENTS } = require('./events');

class JasonBotTrader {
  constructor() {
    this.isRunning = false;
    this.isPaused = false;
    this.currentCycle = null;
    this.startTime = null;

    // Configurar handlers de eventos
    this.setupEventHandlers();
  }

  /**
   * Configura listeners de eventos
   */
  setupEventHandlers() {
    // Bot lifecycle
    botEvents.on(EVENTS.BOT_ERROR, (error) => {
      logCriticalError('Erro no bot', error);
    });

    botEvents.on(EVENTS.BOT_PAUSED, (data) => {
      logger.warn('Bot pausado', data);
    });

    botEvents.on(EVENTS.BOT_RESUMED, () => {
      logger.info('Bot retomado');
    });

    // Risk events
    botEvents.on(EVENTS.DRAWDOWN_LEVEL_1, (data) => {
      logger.warn('⚠️  Drawdown Nível 1 atingido', data);
      this.handleDrawdownLevel1(data);
    });

    botEvents.on(EVENTS.DRAWDOWN_LEVEL_2, (data) => {
      logger.error('⚠️  Drawdown Nível 2 atingido', data);
      this.handleDrawdownLevel2(data);
    });

    botEvents.on(EVENTS.DRAWDOWN_LEVEL_3, (data) => {
      logger.error('🛑 Drawdown Nível 3 atingido - PARANDO BOT', data);
      this.stop();
    });
  }

  /**
   * Inicia o bot
   */
  async start() {
    try {
      logger.info('🚀 Iniciando Jason Bot Trader...');
      printConfigSummary();

      this.isRunning = true;
      this.startTime = new Date();

      // Emite evento de início
      botEvents.emit(EVENTS.BOT_STARTED, {
        timestamp: this.startTime.toISOString(),
        config: {
          network: config.network.active,
          mode: config.network.mode,
          strategy: config.strategies.default,
        },
      });

      logEvent('BOT_STARTED');

      // TODO: Inicializar módulos (próximas tasks)
      // - Provider blockchain
      // - Coletor de dados
      // - Estratégias
      // - Executor de trades

      logger.info('✅ Bot iniciado com sucesso!');
      logger.info('Aguardando implementação dos módulos de trading...');

      // Mantém processo vivo
      await this.mainLoop();
    } catch (error) {
      logCriticalError('Falha ao iniciar bot', error);
      process.exit(1);
    }
  }

  /**
   * Loop principal do bot
   */
  async mainLoop() {
    while (this.isRunning) {
      try {
        if (!this.isPaused) {
          // TODO: Lógica principal do bot (próximas tasks)
          // - Coletar dados de mercado
          // - Executar estratégia
          // - Gerenciar risco
          // - Executar trades

          logger.debug('Loop principal executando...');
        }

        // Aguarda intervalo de polling
        await this.sleep(config.bot.pollingInterval * 1000);
      } catch (error) {
        logger.error('Erro no loop principal:', error);
        botEvents.emit(EVENTS.BOT_ERROR, error);

        // Aguarda antes de tentar novamente
        await this.sleep(5000);
      }
    }
  }

  /**
   * Para o bot
   */
  async stop() {
    logger.info('🛑 Parando bot...');

    this.isRunning = false;

    // Emite evento de parada
    botEvents.emit(EVENTS.BOT_STOPPED, {
      timestamp: new Date().toISOString(),
      uptime: this.getUptime(),
    });

    logEvent('BOT_STOPPED');

    // TODO: Gerar relatório de ciclo

    logger.info('✅ Bot parado com sucesso!');
    process.exit(0);
  }

  /**
   * Pausa o bot
   */
  pause(duration = null) {
    this.isPaused = true;
    botEvents.emit(EVENTS.BOT_PAUSED, { duration });

    if (duration) {
      setTimeout(() => this.resume(), duration * 1000);
    }
  }

  /**
   * Retoma o bot
   */
  resume() {
    this.isPaused = false;
    botEvents.emit(EVENTS.BOT_RESUMED);
  }

  /**
   * Handler de Drawdown Nível 1 (-5%)
   */
  handleDrawdownLevel1(data) {
    logger.warn('Pausando bot por 30 minutos e trocando para estratégia conservadora');
    this.pause(1800); // 30 min

    // TODO: Trocar para estratégia grid (mais conservadora)
  }

  /**
   * Handler de Drawdown Nível 2 (-10%)
   */
  handleDrawdownLevel2(data) {
    logger.warn('Pausando bot por 2 horas e resetando parâmetros');
    this.pause(7200); // 2h

    // TODO: Resetar parâmetros para valores conservadores
  }

  /**
   * Retorna uptime do bot
   */
  getUptime() {
    if (!this.startTime) return 0;
    return Math.floor((Date.now() - this.startTime.getTime()) / 1000);
  }

  /**
   * Helper para sleep
   */
  sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

// ============================================
// INICIALIZAÇÃO
// ============================================

// Handler de sinais de sistema
process.on('SIGINT', async () => {
  logger.info('\nRecebido SIGINT, encerrando bot...');
  if (bot) {
    await bot.stop();
  }
  process.exit(0);
});

process.on('SIGTERM', async () => {
  logger.info('\nRecebido SIGTERM, encerrando bot...');
  if (bot) {
    await bot.stop();
  }
  process.exit(0);
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Rejection:', reason);
});

process.on('uncaughtException', (error) => {
  logCriticalError('Uncaught Exception', error);
  process.exit(1);
});

// Inicia o bot
const bot = new JasonBotTrader();
bot.start().catch((error) => {
  logCriticalError('Erro fatal ao iniciar bot', error);
  process.exit(1);
});

module.exports = JasonBotTrader;
