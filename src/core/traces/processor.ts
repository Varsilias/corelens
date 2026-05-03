import { FullQueuePolicy } from '../config';
import {
  BatchSpanProcessorConfig,
  Span,
  SpanProcessor,
  SpanProcessorConfig,
  TraceExporter,
  TraceSnapshot,
} from './span';

export type ProcessorSnapshot = {
  startedCount: number;
  endedCount: number;
  sampledCount: number;
  droppedCount: number;
  exportedCount: number;
  currentQueueLength: number;
  unsampledCount: number;
  evictedCount: number;
  backPressureHitCount: number;
  softLimitHitCount: number;
  maxQueueSize: number;
};
export class InMemorySpanProcessor implements SpanProcessor {
  private startedCount = 0;
  private endedCount = 0;
  private sampledCount = 0;
  private unsampledCount = 0;
  private exportedCount = 0;

  // backpressure related stats
  private backPressureHitCount = 0;
  private evictedCount = 0;
  private droppedCount = 0;

  // user defined tracker
  private queue: TraceSnapshot[] = [];
  private maxQueueSize = 1024;
  private softMaxQueueSize: number;
  private fullQueuePolicy: FullQueuePolicy = 'drop-newest'; // default to drop-newest
  private softLimitHitCount = 0;

  // lifecycle tracker
  private isShuttingDown = false;

  constructor(
    public config: SpanProcessorConfig,
    private exporter?: TraceExporter | undefined,
  ) {
    this.maxQueueSize = config.maxQueueSize ?? 1000;
    this.softMaxQueueSize = Math.floor(this.maxQueueSize * 0.8);
    this.fullQueuePolicy = config.fullQueuePolicy ?? 'drop-newest';
  }

  onStart(span: Span): void {
    if (this.isShuttingDown) {
      return;
    }

    this.startedCount++;
  }

  onEnd(span: Span) {
    this.endedCount++;

    if (this.isShuttingDown) {
      this.droppedCount++;
      return;
    }

    if (!span.sampled) {
      this.unsampledCount++;
      return;
    }

    this.sampledCount++;

    const time = span.getTime();

    // bad data, should not be recorded or tracked in stat
    // very unlikely to happen
    if (time.endTime < 0 || time.startTime < 0) {
      this.droppedCount++;
      return;
    }

    if (this.queue.length > this.softMaxQueueSize) {
      this.softLimitHitCount++;
    }

    if (!this.hasCapacity()) {
      this.droppedCount++;
      return;
    }

    this.queue.push(span.toJSON());
  }

  snapshot(): ProcessorSnapshot {
    return {
      startedCount: this.startedCount,
      endedCount: this.endedCount,
      sampledCount: this.sampledCount,
      droppedCount: this.droppedCount,
      exportedCount: this.exportedCount,
      currentQueueLength: this.queue.length,
      maxQueueSize: this.maxQueueSize,
      backPressureHitCount: this.backPressureHitCount,
      evictedCount: this.evictedCount,
      softLimitHitCount: this.softLimitHitCount,
      unsampledCount: this.unsampledCount,
    };
  }

  getFinishedSpans(limit = 100): TraceSnapshot[] {
    return this.queue.slice(-limit);
  }

  clear(): void {
    this.queue = [];
  }

  async forceFlush(): Promise<void> {
    if (!this.exporter) {
      return;
    }

    const batch = [...this.queue];
    if (batch.length === 0) {
      return;
    }

    await this.exporter.export(batch);
    this.exportedCount += batch.length;
    this.queue = [];
  }

  async shutdown(): Promise<void> {
    if (this.isShuttingDown) {
      return;
    }

    this.isShuttingDown = true;
    await withTimeout(
      this.forceFlush(),
      3000,
      'Corelens trace shutdown flush timed out',
    );
    await this.exporter?.shutdown?.();
  }

  get finishedCount(): number {
    return this.queue.length;
  }

  private hasCapacity(): boolean {
    if (this.queue.length < this.maxQueueSize) {
      return true;
    }

    this.backPressureHitCount++;

    if (this.fullQueuePolicy === 'drop-newest') {
      return false;
    }

    if (this.fullQueuePolicy === 'drop-oldest') {
      this.queue.shift();
      this.evictedCount++;
      return this.queue.length < this.maxQueueSize;
    }

    return false;
  }
}

export class BatchSpanProcessor implements SpanProcessor {
  private queue: TraceSnapshot[] = [];
  private timer?: NodeJS.Timeout;
  private isShuttingDown = false;

  private maxQueueSize = 1024;
  private fullQueuePolicy: FullQueuePolicy = 'drop-newest'; // default to drop-newest

  // backpressure related stats
  private backPressureHitCount = 0;
  private evictedCount = 0;
  private droppedCount = 0;
  private flushPromise: Promise<void> | null = null;

  constructor(
    private readonly exporter: TraceExporter,
    private readonly config: BatchSpanProcessorConfig,
  ) {
    this.maxQueueSize = config.maxQueueSize ?? 1000;
    this.fullQueuePolicy = config.fullQueuePolicy;
    this.timer = setInterval(() => {
      void this.forceFlush();
    }, config.scheduledDelayMillis ?? 5000);

    this.timer.unref?.();
  }
  onEnd(span: Span): void {
    if (this.isShuttingDown) return;
    if (!span.sampled) return;

    const time = span.getTime();

    // bad data, should not be recorded or tracked in stat
    // very unlikely to happen
    if (time.endTime < 0 || time.startTime < 0) {
      this.droppedCount++;
      return;
    }

    if (!this.hasCapacity()) {
      this.droppedCount++;
      return;
    }

    this.queue.push(span.toJSON());

    if (this.queue.length >= this.config.maxExportBatchSize) {
      void this.forceFlush();
    }
  }
  // BatchSpanProcessor does not hold statistics
  snapshot(): Record<string, any> {
    return {};
  }
  getFinishedSpans(limit = 100): TraceSnapshot[] {
    return this.queue.slice(-limit);
  }

  async shutdown(): Promise<void> {
    this.isShuttingDown = true;
    if (this.timer) clearInterval(this.timer);

    while (this.queue.length > 0) {
      await this.forceFlush();
    }

    await this.exporter.shutdown?.();
  }

  async forceFlush(): Promise<void> {
    if (this.flushPromise) {
      return this.flushPromise;
    }

    this.flushPromise = (async () => {
      try {
        if (this.queue.length === 0) return;
        const batch = this.queue.splice(0, this.config.maxExportBatchSize);
        await this.exporter.export(batch);
      } finally {
        this.flushPromise = null;
      }
    })();

    return this.flushPromise;
  }

  private hasCapacity(): boolean {
    if (this.queue.length < this.maxQueueSize) {
      return true;
    }

    this.backPressureHitCount++;

    if (this.fullQueuePolicy === 'drop-newest') {
      return false;
    }

    if (this.fullQueuePolicy === 'drop-oldest') {
      this.queue.shift();
      this.evictedCount++;
      return this.queue.length < this.maxQueueSize;
    }

    return false;
  }
}

function withTimeout<T>(
  promise: Promise<T>,
  ms: number,
  message: string,
): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error(message)), ms),
    ),
  ]);
}
