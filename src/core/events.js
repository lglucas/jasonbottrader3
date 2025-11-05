/**
 * Sistema de Eventos - Jason Bot Trader
 * Versão: 0.1.0
 *
 * Event-Driven Architecture para comunicação entre módulos
 * Permite que componentes se comuniquem sem acoplamento direto
 */

const EventEmitter = require('events');

/**
 * Event Emitter global do bot
 */
class BotEventEmitter extends EventEmitter {
  constructor() {
    super();
    this.setMaxListeners(50); // Aumenta limite de listeners
  }

  /**
   * Emite evento com log automático
   */
  emitWithLog(event, data, logger = null) {
    if (logger) {
      logger.debug(`Evento emitido: ${event}`, { data });
    }
    this.emit(event, data);
  }
}

const botEvents = new BotEventEmitter();

/**
 * Lista de eventos disponíveis
 */
const EVENTS = {
  // Bot lifecycle
  BOT_STARTED: 'bot.started',
  BOT_STOPPED: 'bot.stopped',
  BOT_PAUSED: 'bot.paused',
  BOT_RESUMED: 'bot.resumed',
  BOT_ERROR: 'bot.error',

  // Market data
  MARKET_DATA_COLLECTED: 'market.data.collected',
  MARKET_DATA_ERROR: 'market.data.error',

  // Strategy
  STRATEGY_SELECTED: 'strategy.selected',
  STRATEGY_CHANGED: 'strategy.changed',

  // Trading signals
  TRADE_SIGNAL_BUY: 'trade.signal.buy',
  TRADE_SIGNAL_SELL: 'trade.signal.sell',

  // Trade execution
  TRADE_EXECUTED: 'trade.executed',
  TRADE_FAILED: 'trade.failed',
  TRADE_CANCELLED: 'trade.cancelled',

  // Risk management
  STOP_LOSS_TRIGGERED: 'risk.stop_loss_triggered',
  TAKE_PROFIT_TRIGGERED: 'risk.take_profit_triggered',
  DRAWDOWN_LEVEL_1: 'risk.drawdown.level1',
  DRAWDOWN_LEVEL_2: 'risk.drawdown.level2',
  DRAWDOWN_LEVEL_3: 'risk.drawdown.level3',

  // Reporting
  REPORT_GENERATED: 'report.generated',
  CYCLE_STARTED: 'cycle.started',
  CYCLE_ENDED: 'cycle.ended',

  // Gas management
  GAS_TOO_HIGH: 'gas.too_high',
  GAS_ACCEPTABLE: 'gas.acceptable',
};

module.exports = {
  botEvents,
  EVENTS,
};
