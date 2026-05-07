import { withTimeout } from '../../exporters/circuit-breaker';
import { Exporter } from '../../exporters/types';
import { FullQueuePolicy } from '../config/types';
import { diagnostics } from '../diagnostics';
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
  maxQueueSize: number;
  softLimitHitCount?: number;
  failedExportCount?: number;
  flushCount?: number;
  lastExportError?: string;
  lastExportErrorAt?: number;
};
export class SimpleSpanProcessor implements SpanProcessor {
  private startedCount = 0;
  private endedCount = 0;
  private sampledCount = 0;
  private unsampledCount = 0;
  private exportedCount = 0;
  private failedExportCount = 0;
  private droppedCount = 0;
  private lastExportError?: string;
  private lastExportErrorAt?: number;

  private isShuttingDown = false;
  // Track every in-flight export promise
  private pendingExports = new Set<Promise<void>>();

  constructor(
    public config: SpanProcessorConfig,
    private exporter?: Exporter<TraceSnapshot> | undefined,
  ) {}

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

    if (!this.exporter) return;

    // Fire-and-forget: onEnd is synchronous by contract.
    // Errors are captured in stats and optionally reported to stderr.
    const exportPromise = this.exporter
      .export([span.toJSON()])
      .then(() => {
        this.exportedCount++;
      })
      .catch((error: unknown) => {
        this.failedExportCount++;
        this.reportExportFailure(error);
      })
      .finally(() => {
        this.pendingExports.delete(exportPromise);
      });

    this.pendingExports.add(exportPromise);
  }

  snapshot(): ProcessorSnapshot {
    return {
      startedCount: this.startedCount,
      endedCount: this.endedCount,
      sampledCount: this.sampledCount,
      droppedCount: this.droppedCount,
      exportedCount: this.exportedCount,
      unsampledCount: this.unsampledCount,
      failedExportCount: this.failedExportCount,
      lastExportError: this.lastExportError,
      lastExportErrorAt: this.lastExportErrorAt,
      // these have no meaning in simple mode but ProcessorSnapshot requires them
      currentQueueLength: 0,
      maxQueueSize: 0,
      backPressureHitCount: 0,
      evictedCount: 0,
      softLimitHitCount: 0,
    };
  }

  getFinishedSpans(limit = 100): TraceSnapshot[] {
    return [];
  }

  async forceFlush(timeoutMs = 5000): Promise<void> {
    if (this.pendingExports.size === 0) return;
    const drain = Promise.allSettled(this.pendingExports);

    await withTimeout(
      drain,
      timeoutMs,
      `forceFlush timed out after ${timeoutMs}ms`,
    );
  }

  async shutdown(): Promise<void> {
    if (this.isShuttingDown) return;
    this.isShuttingDown = true;

    // Drain in-flight exports before tearing down the exporter.
    // forceFlush errors are intentionally swallowed here — we still
    // want exporter shutdown to proceed even if the flush times out.
    await this.forceFlush().catch((error: unknown) => {
      if (this.config.diagnostics?.warnOnExportFailure) {
        diagnostics.warn(
          `[Corelens] forceFlush timed out during shutdown: ${error instanceof Error ? error.message : String(error)}\n`,
        );
      }
    });

    await this.exporter?.shutdown?.();
  }

  private reportExportFailure(error: unknown): void {
    this.lastExportError =
      error instanceof Error ? error.message : String(error);

    this.lastExportErrorAt = Date.now();

    if (this.config.diagnostics?.warnOnExportFailure) {
      diagnostics.warn(
        `[Corelens] Trace export failed: ${this.lastExportError}\n`,
      );
    }
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
  private startedCount = 0;
  private endedCount = 0;
  private sampledCount = 0;
  private unsampledCount = 0;
  private exportedCount = 0;
  private failedExportCount = 0;
  private flushCount = 0;
  private lastExportError?: string;
  private lastExportErrorAt?: number;
  private flushAbortController?: AbortController;

  constructor(
    private readonly exporter: TraceExporter,
    private readonly config: BatchSpanProcessorConfig,
  ) {
    this.maxQueueSize = config.maxQueueSize ?? 1000;
    this.fullQueuePolicy = config.fullQueuePolicy ?? 'drop-newest';
    this.timer = setInterval(() => {
      void this.forceFlush().catch((error) => {
        this.reportExportFailure(error);
      });
    }, config.scheduledDelayMs ?? 5000);

    this.timer.unref?.();
  }
  onStart(span: Span): void {
    if (this.isShuttingDown) {
      return;
    }

    this.startedCount++;
  }
  onEnd(span: Span): void {
    this.endedCount++;

    if (this.isShuttingDown) return;

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

    if (!this.hasCapacity()) {
      this.droppedCount++;
      return;
    }

    this.queue.push(span.toJSON());

    if (this.queue.length >= this.config.maxExportBatchSize) {
      void this.forceFlush().catch((error) => {
        this.reportExportFailure(error);
      });
    }
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
      unsampledCount: this.unsampledCount,
      flushCount: this.flushCount,
      failedExportCount: this.failedExportCount,
      lastExportError: this.lastExportError,
      lastExportErrorAt: this.lastExportErrorAt,
    };
  }
  getFinishedSpans(limit = 100): TraceSnapshot[] {
    return [];
  }

  async shutdown(): Promise<void> {
    if (this.isShuttingDown) return;
    this.isShuttingDown = true;
    if (this.timer) clearInterval(this.timer);
    const controller = new AbortController();

    try {
      await withTimeout(
        this.forceFlush(controller.signal),
        this.config.shutdownTimeoutMs ?? 3000,
        `[Corelens] trace shutdown flush timed out`,
        controller,
      );
    } catch (error: any) {
      this.reportExportFailure(error);
    }

    try {
      await this.exporter.shutdown?.();
    } catch (error) {
      this.reportExportFailure(error);
    }
  }

  forceFlush(signal?: AbortSignal): Promise<void> {
    if (this.flushPromise) {
      if (signal) {
        const abortActiveFlush = () => this.flushAbortController?.abort();
        signal.addEventListener('abort', abortActiveFlush, { once: true });
        void this.flushPromise
          .finally(() => signal.removeEventListener('abort', abortActiveFlush))
          .catch(() => {});
      }
      return this.flushPromise;
    }

    const controller = new AbortController();
    this.flushAbortController = controller;
    const abort = () => controller.abort();
    signal?.addEventListener('abort', abort, { once: true });

    this.flushPromise = this.drainQueue(controller.signal).finally(() => {
      signal?.removeEventListener('abort', abort);
      this.flushAbortController = undefined;
      this.flushPromise = null;
    });

    return this.flushPromise;
  }

  private async drainQueue(signal?: AbortSignal): Promise<void> {
    while (this.queue.length > 0) {
      if (signal?.aborted) {
        throw new DOMException('Trace flush aborted', 'AbortError');
      }
      await this.flushOnce(signal);
    }
  }

  private async flushOnce(signal?: AbortSignal): Promise<void> {
    if (this.queue.length === 0) {
      return;
    }

    const batch = this.queue.slice(0, this.config.maxExportBatchSize);

    try {
      await this.exporter.export(batch, signal);

      this.queue.splice(0, batch.length);
      this.exportedCount += batch.length;
      this.flushCount++;
    } catch (error) {
      this.failedExportCount++;
      this.reportExportFailure(error);

      // keep spans in queue for next retry/interval
      throw error;
    }
  }

  private reportExportFailure(error: unknown): void {
    this.lastExportError =
      error instanceof Error ? error.message : String(error);

    this.lastExportErrorAt = Date.now();

    if (this.config.diagnostics?.warnOnExportFailure) {
      diagnostics.warn(
        `[Corelens] Trace export failed: ${this.lastExportError}\n`,
      );
    }
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
