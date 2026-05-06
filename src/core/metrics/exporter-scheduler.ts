import { MetricsRegistry, MetricsSnapshot } from './registry';
import { Exporter } from '../../exporters/types';
import { Processor } from '../traces/span';
import { withTimeout } from '../../exporters/circuit-breaker';
import { diagnostics } from '../diagnostics';

type SchedulerConfig = {
  scheduledDelayMs: number;
  shutdownTimeoutMs: number;
  diagnostics?: {
    warnOnExportFailure?: boolean;
  };
};

export class MetricsExportScheduler implements Processor {
  private timer?: NodeJS.Timeout;
  private isShuttingDown = false;
  private flushCount = 0;
  private failedExportCount = 0;
  private lastExportError?: string;
  private lastExportErrorAt?: number;
  private activeFlushController?: AbortController;

  constructor(
    private readonly registry: MetricsRegistry,
    private readonly exporter: Exporter<MetricsSnapshot>,
    private readonly config: SchedulerConfig,
  ) {}

  start(): void {
    this.timer = setInterval(() => {
      void this.flush().catch((err) => this.reportFailure(err));
    }, this.config.scheduledDelayMs);

    this.timer.unref?.();
  }

  async flush(): Promise<void> {
    if (this.isShuttingDown) return;
    const controller = new AbortController();
    this.activeFlushController = controller;
    try {
      await this.flushNow(controller.signal);
    } finally {
      if (this.activeFlushController === controller) {
        this.activeFlushController = undefined;
      }
    }
  }

  private async flushNow(signal?: AbortSignal): Promise<void> {
    const snapshot = this.registry.snapshot();
    if (snapshot.entries.length === 0) return;

    try {
      await this.exporter.export([snapshot], signal);
      this.flushCount++;
    } catch (error) {
      this.reportFailure(error);
      throw error;
    }
  }

  async shutdown(): Promise<void> {
    if (this.isShuttingDown) return;
    this.isShuttingDown = true;

    if (this.timer) clearInterval(this.timer);
    this.activeFlushController?.abort();
    const controller = new AbortController();

    await withTimeout(
      this.flushNow(controller.signal),
      this.config.shutdownTimeoutMs,
      '[Corelens] Metrics export scheduler shutdown flush timed out',
      controller,
    );

    await this.exporter.shutdown?.();
  }

  snapshot() {
    return {
      flushCount: this.flushCount,
      failedExportCount: this.failedExportCount,
      lastExportError: this.lastExportError,
      lastExportErrorAt: this.lastExportErrorAt,
    };
  }

  private reportFailure(error: unknown): void {
    this.failedExportCount++;
    this.lastExportError =
      error instanceof Error ? error.message : String(error);
    this.lastExportErrorAt = Date.now();

    if (this.config.diagnostics?.warnOnExportFailure) {
      diagnostics.warn(
        `[Corelens] Metrics export failed: ${this.lastExportError}\n`,
      );
    }
  }
}
