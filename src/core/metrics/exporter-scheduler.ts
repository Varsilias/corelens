import { MetricsRegistry, MetricsSnapshot } from './registry';
import { Exporter } from '../../exporters/types';
import { Processor } from '../traces/span';
import { withTimeout } from '../../exporters/circuit-breaker';

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
    await this.flushNow();
  }

  private async flushNow(): Promise<void> {
    const snapshot = this.registry.snapshot();
    if (snapshot.entries.length === 0) return;

    try {
      await this.exporter.export([snapshot]);
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

    await withTimeout(
      this.flushNow(),
      this.config.shutdownTimeoutMs,
      '[Corelens] Metrics export scheduler shutdown flush timed out',
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
      process.stderr.write(
        `[Corelens] Metrics export failed: ${this.lastExportError}\n`,
      );
    }
  }
}
