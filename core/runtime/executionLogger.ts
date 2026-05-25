/**
 * Structured logging for ExecutionContext — no console.* in capability code paths.
 */

export interface ExecutionLogger {
  info(message: string, meta?: Record<string, unknown>): void;
  warn(message: string, meta?: Record<string, unknown>): void;
  error(message: string, meta?: Record<string, unknown>): void;
  debug(message: string, meta?: Record<string, unknown>): void;
}

export class ConsoleExecutionLogger implements ExecutionLogger {
  info(message: string, meta?: Record<string, unknown>): void {
    if (meta && Object.keys(meta).length) {
      console.log(`[execution] ${message}`, meta);
    } else {
      console.log(`[execution] ${message}`);
    }
  }

  warn(message: string, meta?: Record<string, unknown>): void {
    if (meta && Object.keys(meta).length) {
      console.warn(`[execution] ${message}`, meta);
    } else {
      console.warn(`[execution] ${message}`);
    }
  }

  error(message: string, meta?: Record<string, unknown>): void {
    if (meta && Object.keys(meta).length) {
      console.error(`[execution] ${message}`, meta);
    } else {
      console.error(`[execution] ${message}`);
    }
  }

  debug(message: string, meta?: Record<string, unknown>): void {
    if (meta && Object.keys(meta).length) {
      console.debug(`[execution] ${message}`, meta);
    } else {
      console.debug(`[execution] ${message}`);
    }
  }
}

let defaultLogger: ExecutionLogger | null = null;

export function getDefaultExecutionLogger(): ExecutionLogger {
  if (!defaultLogger) {
    defaultLogger = new ConsoleExecutionLogger();
  }
  return defaultLogger;
}

export function setDefaultExecutionLogger(logger: ExecutionLogger): void {
  defaultLogger = logger;
}
