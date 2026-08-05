type LogLevel = 'info' | 'warn' | 'error' | 'debug';

/** Scoped logger — prefixes all output with a module tag for traceability. */
export class Logger {
  private readonly scope: string;

  constructor(scope: string) {
    this.scope = scope;
  }

  private write(level: LogLevel, message: string, meta?: unknown) {
    const prefix = `[${new Date().toISOString()}] [${this.scope}] [${level.toUpperCase()}]`;
    const fn = level === 'error' ? console.error : level === 'warn' ? console.warn : console.log;
    fn(prefix, message, meta ?? '');
  }

  info(message: string, meta?: unknown) {
    this.write('info', message, meta);
  }
  warn(message: string, meta?: unknown) {
    this.write('warn', message, meta);
  }
  error(message: string, meta?: unknown) {
    this.write('error', message, meta);
  }
  debug(message: string, meta?: unknown) {
    if (import.meta.env.DEV) this.write('debug', message, meta);
  }

  child(subScope: string): Logger {
    return new Logger(`${this.scope}:${subScope}`);
  }
}

export const createLogger = (scope: string) => new Logger(scope);
