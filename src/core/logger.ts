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
  private threshold =
    LEVEL_PRIORITY[(process.env.CORELENS_LOG_LEVEL as LogLevel) || 'info'];

  constructor(
    private coreLensConfig: NormalisedConfig,
    private pipeline: IPipeline,
  ) {}

  private createLogMethod(level: LogLevel) {
    return (message: string, context?: Record<string, any>) => {
      if (LEVEL_PRIORITY[level] < this.threshold) {
        return;
      }
      this.pipeline.handle({
        level,
        message,
        context,
        timestamp: Date.now(),
      } as LogEvent);
    };
  }
  info = this.createLogMethod('info');
  error = this.createLogMethod('error');
  debug = this.createLogMethod('debug');
  warn = this.createLogMethod('warn');
}
