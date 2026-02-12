/**
 * Logger utility
 * 
 * In development: outputs to console with level prefixes.
 * In production: consider replacing with Winston or Pino for
 * structured logging, log rotation, and external transport support.
 */
const isDevelopment = process.env.NODE_ENV !== 'PRODUCTION';

const logger = {
  error: (message, ...args) => {
    console.error(`[ERROR] ${new Date().toISOString()} - ${message}`, ...args);
  },
  warn: (message, ...args) => {
    if (isDevelopment) {
      console.warn(`[WARN] ${new Date().toISOString()} - ${message}`, ...args);
    }
  },
  info: (message, ...args) => {
    if (isDevelopment) {
      console.info(`[INFO] ${new Date().toISOString()} - ${message}`, ...args);
    }
  },
  debug: (message, ...args) => {
    if (isDevelopment) {
      console.debug(`[DEBUG] ${new Date().toISOString()} - ${message}`, ...args);
    }
  },
};

module.exports = logger;
