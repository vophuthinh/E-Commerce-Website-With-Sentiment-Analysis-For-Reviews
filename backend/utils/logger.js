// Simple logger utility
// In production, consider using winston or pino

const logger = {
  error: (...args) => {
    if (process.env.NODE_ENV !== 'production') {
      console.error('[ERROR]', ...args);
    }
    // In production, send to logging service
  },
  
  warn: (...args) => {
    if (process.env.NODE_ENV !== 'production') {
      console.warn('[WARN]', ...args);
    }
  },
  
  info: (...args) => {
    if (process.env.NODE_ENV !== 'production') {
      console.log('[INFO]', ...args);
    }
  },
  
  debug: (...args) => {
    if (process.env.NODE_ENV === 'development') {
      console.log('[DEBUG]', ...args);
    }
  }
};

module.exports = logger;

