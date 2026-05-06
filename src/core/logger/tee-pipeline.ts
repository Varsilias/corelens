import { LogEvent } from '.';
import { withTimeout } from '../../exporters/circuit-breaker';
import { Exporter } from '../../exporters/types';
import { FullQueuePolicy } from '../config';
import { IPipeline, PipelineStats } from './pipeline';

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

    this.flushPromise = this.flushOnce().finally(() => {
      this.flushPromise = null;
    });

    return this.flushPromise;
  }

  private async flushOnce(): Promise<void> {
    if (this.queue.length === 0) return;

    const batch = this.queue.slice(0, this.config.maxExportBatchSize);

    try {
      await this.secondary.export(batch);
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
    this.isShuttingDown = true;
    if (this.timer) clearInterval(this.timer);

    // Drain stdout first, then attempt final export flush concurrently.
    // allSettled ensures a secondary failure never blocks stdout from draining.
    await Promise.allSettled([
      this.primary.flushAll(),
      withTimeout(
        this.forceFlush(),
        this.config.shutdownTimeoutMs,
        '[Corelens] Log export tee flush timed out',
      ).catch((err) => this.reportFailure(err)),
    ]);

    try {
      await this.secondary.shutdown?.();
    } catch (error) {
      this.reportFailure(error);
    }
  }

  getStats(): PipelineStats {
    return this.primary.getStats();
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
      process.stderr.write(
        `[Corelens] Log export to secondary sink failed: ${this.lastExportError}\n`,
      );
    }
  }
}
