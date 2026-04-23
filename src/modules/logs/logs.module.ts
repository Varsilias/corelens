import { Module } from '../../core/modules';
import { ModuleContext } from '../../core/context';
import { LogsPipeline } from '../../core/pipeline';
import { CorelensWriter } from '../../core/writer';

export type LogEvent = {
  level: string;
  message: string;
  timestamp: number;
  context?: Record<string, any>;
};

export class LogsModule implements Module {
  private pipeline: LogsPipeline;

  constructor(private ctx: ModuleContext) {
    const writer = new CorelensWriter({ highWaterMark: 64 * 1024 });
    this.pipeline = new LogsPipeline({
      writer,
      maxQueueBytes: this.ctx.config.logs.maxQueueBytes ?? 4 * 1024 * 1024,
      fullQueuePolicy: this.ctx.config.logs.fullQueuePolicy,
    });
  }

  getPipeline(): LogsPipeline {
    return this.pipeline;
  }

  getPipelineStats() {
    return this.pipeline.getStats();
  }

  //
  init(): void {
    // console.log('LogsModule initialised');
  }
  start(): void {
    // console.log('LogsModule started');
  }
  async stop(): Promise<void> {
    await this.pipeline.flushAll();
  }
}
