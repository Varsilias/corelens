import {
  BeforeApplicationShutdown,
  Inject,
  Injectable,
  OnModuleDestroy,
} from '@nestjs/common';
import { corelens, Corelens, CorelensConfig } from '../../core';
import { CORELENS_CONFIG } from './token';

@Injectable()
export class CorelensService
  implements OnModuleDestroy, BeforeApplicationShutdown
{
  private lens: Corelens;
  private isShuttingDown = false;

  constructor(@Inject(CORELENS_CONFIG) private config: CorelensConfig) {
    this.lens = corelens(config);
  }

  get snapshot() {
    return this.lens.getStats();
  }

  get logger() {
    return this.lens.logger;
  }

  get metrics() {
    return this.lens.metrics;
  }

  get tracer() {
    return this.lens.tracer;
  }

  get httpMetricsRecorder() {
    return this.lens.httpMetricsRecorder;
  }

  get httpTracingRecorder() {
    return this.lens.httpTracingRecorder;
  }

  async onModuleDestroy() {
    if (this.isShuttingDown) {
      return;
    }
    await this.lens.shutdown();
    this.isShuttingDown = true;
  }

  beforeApplicationShutdown() {
    if (this.isShuttingDown) {
      return;
    }
    this.lens.shutdown();
    this.isShuttingDown = true;
  }
}
