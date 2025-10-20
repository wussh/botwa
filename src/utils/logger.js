/**
 * Logger Utility
 * Centralized logging configuration
 */

import pino from 'pino';
import config from '../config/index.js';

/**
 * Create and configure logger instance
 * @returns {pino.Logger} Configured logger
 */
export function createLogger() {
  return pino({
    level: config.LOG_LEVEL,
    transport: {
      target: 'pino-pretty',
      options: {
        colorize: true,
        translateTime: 'SYS:standard',
        ignore: 'pid,hostname'
      }
    }
  });
}

// Export singleton logger instance
export const logger = createLogger();

export default logger;
