import { NormalisedConfig } from '../config';
import { ContextProvider } from '../traces';
import { IPipeline } from './pipeline';

export type LogEvent = {
  level: string;
  message: string;
  serviceName: string;
  timestamp: number | string;
  context?: Record<string, any>;
  traceId?: string;
  spanId?: string;
};

export type LogLevel = 'info' | 'error' | 'debug' | 'warn';

const LEVEL_PRIORITY = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

export interface ILogger {
  debug(message: string, context?: Record<string, any>): void;
  info(message: string, context?: Record<string, any>): void;
  warn(message: string, context?: Record<string, any>): void;
  error(message: string, context?: Record<string, any>): void;
}

export class Logger implements ILogger {
  private threshold: number;
  private serviceName: string;
  private getTimestamp: () => number | string;

  constructor(
    private config: NormalisedConfig,
    private pipeline: IPipeline,
    private contextProvider?: ContextProvider,
  ) {
    this.serviceName = config.serviceName;
    this.threshold = LEVEL_PRIORITY[config.logs.level];
    this.getTimestamp =
      config.logs.timestamp.format === 'epoch'
        ? () => Date.now()
        : () => new Date().toISOString();
  }

  info(m: string, c?: Record<string, any>) {
    this.log('info', m, c);
  }
  error(m: string, c?: Record<string, any>) {
    this.log('error', m, c);
  }
  debug(m: string, c?: Record<string, any>) {
    this.log('debug', m, c);
  }
  warn(m: string, c?: Record<string, any>) {
    this.log('warn', m, c);
  }

  private log(level: LogLevel, message: string, context?: Record<string, any>) {
    if (LEVEL_PRIORITY[level] < this.threshold) {
      return;
    }

    const traceContext = this.config.logs.enrichWithTraceContext
      ? this.contextProvider?.getTraceContext()
      : undefined;

    this.pipeline.handle({
      level,
      message,
      serviceName: this.serviceName,
      context,
      traceId: traceContext?.traceId,
      spanId: traceContext?.spanId,
      timestamp: this.getTimestamp(),
    } as LogEvent);
  }
}
