import { Module } from '../../core/modules';
import { ModuleContext } from '../../core/context';
import { LogsPipeline } from '../../core/pipeline';
import { CorelensWriter } from '../../core/writer';

export type LogEvent = {
  level: string;
  message: string;
  serviceName: string;
  timestamp: number;
  context?: Record<string, any>;
};

export class LogsModule implements Module {
  private pipeline: LogsPipeline;

  constructor(private ctx: ModuleContext) {
    const { config } = this.ctx;

    const format =
      config.logs.format === 'pretty'
        ? (event: LogEvent) => this.formatPretty(event)
        : (event: LogEvent) => JSON.stringify(event);

    const writer = new CorelensWriter({ highWaterMark: 64 * 1024 });
    this.pipeline = new LogsPipeline({
      writer,
      maxQueueBytes: config.logs.maxQueueBytes ?? 4 * 1024 * 1024,
      fullQueuePolicy: config.logs.fullQueuePolicy,
      format,
    });
  }

  getPipeline(): LogsPipeline {
    return this.pipeline;
  }

  getPipelineStats() {
    return this.pipeline.getStats();
  }

  //
  init(): void {}
  start(): void {}
  async stop(): Promise<void> {
    await this.pipeline.flushAll();
  }

  private formatPretty(event: LogEvent): string {
    const { colorize } = this.ctx.config.logs;
    const color = colorize ? this.getColorForLevel(event.level) : '';
    const reset = colorize ? '\x1b[0m' : '';

    const time = event.timestamp;
    const level = event.level.toUpperCase().padEnd(5);

    let base = `${color}[${time}] ${level}${reset}: ${event.message}`;

    if (event.context && Object.keys(event.context).length > 0) {
      base += `\n${JSON.stringify(event.context, null, 2)}`;
    }

    return base;
  }

  private getColorForLevel(level: string): string {
    switch (level) {
      case 'info':
        return '\x1b[32m'; // Green
      case 'warn':
        return '\x1b[33m'; // Yellow
      case 'error':
        return '\x1b[31m'; // Red
      case 'debug':
        return '\x1b[36m'; // Cyan
      default:
        return '\x1b[37m'; // White
    }
  }
}
