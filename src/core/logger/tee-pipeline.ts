import { LogEvent } from '.';
import { diagnostics } from '../diagnostics';
import { withTimeout } from '../../exporters/circuit-breaker';
import { Exporter } from '../../exporters/types';
import { FullQueuePolicy } from '../config/types';
import { IPipeline, LogsPipelineStats } from './pipeline';

type TeePipelineConfig = {
  maxQueueSize: number;
  maxExportBatchSize: number;
  scheduledDelayMs: number;
  shutdownTimeoutMs: number;
  fullQueuePolicy: FullQueuePolicy;
  diagnostics: { warnOnExportFailure: boolean };
};

export class TeePipeline implements IPipeline {
  private queue: LogEvent[] = [];
  private timer?: NodeJS.Timeout;
  private isShuttingDown = false;

  // export stats
  private exportedCount = 0;
  private failedExportCount = 0;
  private droppedCount = 0;
  private flushCount = 0;
  private lastExportError?: string;
  private lastExportErrorAt?: number;

  private flushPromise: Promise<void> | null = null;
  private flushAbortController?: AbortController;
  private shutdownPromise: Promise<void> | null = null;

  constructor(
    private readonly primary: IPipeline,
    private readonly secondary: Exporter<LogEvent>,
    private readonly config: TeePipelineConfig,
  ) {
    this.timer = setInterval(() => {
      void this.forceFlush().catch((err) => this.reportFailure(err));
    }, config.scheduledDelayMs);

    this.timer.unref?.();
  }

  handle(event: LogEvent): boolean {
    const accepted = this.primary.handle(event);

    if (this.isShuttingDown) return accepted;

    if (this.queue.length >= this.config.maxQueueSize) {
      if (this.config.fullQueuePolicy === 'drop-newest') {
        this.droppedCount++;
        return accepted;
      }

      if (this.config.fullQueuePolicy === 'drop-oldest') {
        this.queue.shift();
        this.droppedCount++;
      }
    }

    this.queue.push(event);

    if (this.queue.length >= this.config.maxExportBatchSize) {
      void this.forceFlush().catch((err) => this.reportFailure(err));
    }

    return accepted;
  }

  // Deduplicates concurrent flush calls — if a flush is already in flight,
  // callers wait on the same promise rather than spawning a second export.
  async forceFlush(): Promise<void> {
    if (this.flushPromise) {
      return this.flushPromise;
    }

    const controller = new AbortController();
    this.flushAbortController = controller;

    this.flushPromise = this.flushOnce(controller.signal).finally(() => {
      this.flushAbortController = undefined;
      this.flushPromise = null;
    });

    return this.flushPromise;
  }

  private async flushOnce(signal?: AbortSignal): Promise<void> {
    if (this.queue.length === 0) return;

    const batch = this.queue.slice(0, this.config.maxExportBatchSize);

    try {
      await this.secondary.export(batch, signal);
      this.queue.splice(0, batch.length);
      this.exportedCount += batch.length;
      this.flushCount++;
    } catch (error) {
      this.failedExportCount++;
      this.reportFailure(error);
      throw error;
    }
  }

  async flushAll(): Promise<void> {
    if (this.shutdownPromise) {
      return this.shutdownPromise;
    }

    this.shutdownPromise = this.shutdownOnce();
    return this.shutdownPromise;
  }

  private async shutdownOnce(): Promise<void> {
    this.isShuttingDown = true;
    if (this.timer) clearInterval(this.timer);

    this.flushPromise = this.drainQueue(this.config.shutdownTimeoutMs).finally(
      () => {
        this.flushPromise = null;
      },
    );

    // Drain stdout first, then attempt final export flush concurrently.
    // allSettled ensures a secondary failure never blocks stdout from draining.
    await Promise.allSettled([this.primary.flushAll(), this.flushPromise]);

    try {
      await this.secondary.shutdown?.();
    } catch (error) {
      this.reportFailure(error);
    }
  }

  private async drainQueue(deadlineMs: number): Promise<void> {
    const deadline = Date.now() + deadlineMs;

    while (this.queue.length > 0) {
      const remainingMs = deadline - Date.now();
      if (remainingMs <= 0) {
        const dropped = this.queue.length;
        this.droppedCount += dropped;
        diagnostics.warn(
          `[Corelens] Shutdown deadline exceeded — ${dropped} log event(s) discarded\n`,
        );
        break;
      }

      // Wait for any in-flight flush to settle before taking the next batch,
      // so we never have two concurrent exports racing on the same queue slice.
      if (this.flushPromise) {
        this.flushAbortController?.abort();
        await this.flushPromise.catch(() => {});
      }

      const controller = new AbortController();
      try {
        await withTimeout(
          this.flushOnce(controller.signal),
          remainingMs,
          '[Corelens] Log export tee flush timed out',
          controller,
        );
      } catch (err) {
        this.reportFailure(err);
        const dropped = this.queue.length;
        this.droppedCount += dropped;
        if (dropped > 0) {
          diagnostics.warn(
            `[Corelens] Log export failed during shutdown — ${dropped} log event(s) discarded\n`,
          );
        }
        break;
      }
    }
  }

  getStats(): LogsPipelineStats {
    return {
      primary: this.primary.getStats().primary,
      tee: this.snapshot(),
    };
  }

  snapshot() {
    return {
      exportedCount: this.exportedCount,
      failedExportCount: this.failedExportCount,
      droppedCount: this.droppedCount,
      flushCount: this.flushCount,
      currentQueueLength: this.queue.length,
      lastExportError: this.lastExportError,
      lastExportErrorAt: this.lastExportErrorAt,
    };
  }

  private reportFailure(error: unknown): void {
    this.lastExportError =
      error instanceof Error ? error.message : String(error);
    this.lastExportErrorAt = Date.now();

    if (this.config.diagnostics.warnOnExportFailure) {
      diagnostics.warn(
        `[Corelens] Log export to secondary sink failed: ${this.lastExportError}\n`,
      );
    }
  }
}
