import { LogEvent } from '../modules';
import { NormalisedConfig } from './config';
import { IPipeline } from './pipeline';

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
    this.pipeline.handle({
      level,
      message,
      serviceName: this.serviceName,
      context,
      timestamp: this.getTimestamp(),
    } as LogEvent);
  }
}
