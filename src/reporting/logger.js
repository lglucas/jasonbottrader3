/**
 * Logger Estruturado - Jason Bot Trader
 * Versão: 0.1.0
 *
 * Sistema de logs usando Winston
 * - Logs coloridos no console
 * - Logs em arquivos com rotação
 * - Níveis: error, warn, info, debug
 */

const winston = require('winston');
const path = require('path');
const fs = require('fs');
const { config } = require('../core/config');

// Garante que diretório de logs existe
const logDir = config.paths.logs;
if (!fs.existsSync(logDir)) {
  fs.mkdirSync(logDir, { recursive: true });
}

/**
 * Formato customizado para logs
 */
const customFormat = winston.format.combine(
  winston.format.timestamp({
    format: 'YYYY-MM-DD HH:mm:ss',
  }),
  winston.format.errors({ stack: true }),
  winston.format.splat(),
  winston.format.printf((info) => {
    const { timestamp, level, message, ...meta } = info;

    let log = `${timestamp} [${level.toUpperCase()}]: ${message}`;

    // Adiciona metadados se existirem
    if (Object.keys(meta).length > 0 && !meta[Symbol.for('splat')]) {
      log += ` ${JSON.stringify(meta, null, 2)}`;
    }

    // Adiciona stack trace se for erro
    if (info.stack) {
      log += `\n${info.stack}`;
    }

    return log;
  })
);

/**
 * Formato colorido para console
 */
const consoleFormat = winston.format.combine(
  winston.format.colorize(),
  winston.format.timestamp({
    format: 'HH:mm:ss',
  }),
  winston.format.printf((info) => {
    const { timestamp, level, message, ...meta } = info;

    let log = `${timestamp} ${level}: ${message}`;

    // Adiciona metadados de forma compacta
    if (Object.keys(meta).length > 0 && !meta[Symbol.for('splat')]) {
      const metaStr = JSON.stringify(meta);
      if (metaStr.length < 100) {
        log += ` ${metaStr}`;
      } else {
        log += ` {...}`;
      }
    }

    return log;
  })
);

/**
 * Cria logger principal
 */
const logger = winston.createLogger({
  level: config.logLevel,
  format: customFormat,
  transports: [
    // Console (colorido)
    new winston.transports.Console({
      format: consoleFormat,
    }),

    // Arquivo de erros
    new winston.transports.File({
      filename: path.join(logDir, 'error.log'),
      level: 'error',
      maxsize: 5242880, // 5MB
      maxFiles: 5,
    }),

    // Arquivo combinado
    new winston.transports.File({
      filename: path.join(logDir, 'combined.log'),
      maxsize: 5242880, // 5MB
      maxFiles: 5,
    }),

    // Arquivo de trades (separado para análise)
    new winston.transports.File({
      filename: path.join(logDir, 'trades.log'),
      level: 'info',
      maxsize: 10485760, // 10MB
      maxFiles: 10,
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.json()
      ),
    }),
  ],
});

/**
 * Logger específico para trades (formato JSON para parsing)
 */
const tradeLogger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.File({
      filename: path.join(logDir, 'trades.log'),
      maxsize: 10485760, // 10MB
      maxFiles: 10,
    }),
  ],
});

/**
 * Helper para logar trades de forma estruturada
 */
function logTrade(type, data) {
  const tradeLog = {
    type, // 'buy', 'sell', 'cancelled'
    timestamp: new Date().toISOString(),
    ...data,
  };

  tradeLogger.info('TRADE', tradeLog);
  logger.info(`Trade ${type.toUpperCase()}: ${data.pair}`, tradeLog);
}

/**
 * Helper para logar eventos importantes
 */
function logEvent(event, data = {}) {
  logger.info(`EVENT: ${event}`, data);
}

/**
 * Helper para logar métricas
 */
function logMetrics(metrics) {
  logger.info('METRICS', metrics);
}

/**
 * Helper para logar erros críticos
 */
function logCriticalError(message, error) {
  logger.error(`CRITICAL: ${message}`, {
    error: error.message,
    stack: error.stack,
  });
}

/**
 * Cleanup de logs antigos (rotação manual)
 */
function cleanupOldLogs() {
  const retentionDays = config.retention.logs;
  const now = Date.now();
  const maxAge = retentionDays * 24 * 60 * 60 * 1000;

  try {
    const files = fs.readdirSync(logDir);

    files.forEach((file) => {
      const filePath = path.join(logDir, file);
      const stats = fs.statSync(filePath);
      const age = now - stats.mtimeMs;

      if (age > maxAge) {
        fs.unlinkSync(filePath);
        logger.info(`Log antigo removido: ${file}`);
      }
    });
  } catch (error) {
    logger.error('Erro ao limpar logs antigos:', error);
  }
}

// Cleanup automático ao iniciar
cleanupOldLogs();

module.exports = {
  logger,
  tradeLogger,
  logTrade,
  logEvent,
  logMetrics,
  logCriticalError,
  cleanupOldLogs,
};
