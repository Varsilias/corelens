import { Module } from '../../core/config';
import { ModuleContext } from '../../core/config';
import { MetricsRegistry, MetricsSnapshot } from '../../core';
import { RuntimeMetricsCollector } from '../../collectors/runtime';
import { MetricsExportScheduler } from '../../core/metrics/exporter-scheduler';
import { ConsoleExporter } from '../../exporters/console';
import {
  MetricsConsoleFormatter,
  MetricsFileFormatter,
  MetricsOtlpFormatter,
} from '../../core/metrics/formatter';
import { FileExporter } from '../../exporters/file';
import { OtlpHttpExporter } from '../../exporters/otlp-http';
import { Exporter } from '../../exporters/types';
import { NoopExporter } from '../../exporters/noop';
import { ExporterBuilder } from '../../exporters/builder';

export class MetricsModule implements Module {
  private registry: MetricsRegistry;
  private runtimeCollector?: RuntimeMetricsCollector;
  private scheduler?: MetricsExportScheduler;
  private exporter: Exporter<MetricsSnapshot>;

  constructor(private ctx: ModuleContext) {
    const { config } = this.ctx;
    this.registry = new MetricsRegistry({
      maxSeriesPerMetric: config.metrics.maxSeriesPerMetric,
    });
    if (config.metrics.runtime.enabled) {
      this.runtimeCollector = new RuntimeMetricsCollector(this.registry, {
        intervalMs: ctx.config.metrics.runtime.intervalMs,
      });
    }

    const exportCfg = config.export;
    const metricSignalCfg = config.export?.signals?.metrics;

    this.exporter = this.buildExporter();

    if (exportCfg.enabled && (metricSignalCfg?.enabled ?? true)) {
      this.scheduler = new MetricsExportScheduler(
        this.registry,
        this.exporter,
        {
          scheduledDelayMs:
            metricSignalCfg?.batch?.scheduledDelayMs ??
            exportCfg.batch.scheduledDelayMs,
          shutdownTimeoutMs:
            metricSignalCfg?.batch?.shutdownTimeoutMs ??
            exportCfg.batch.shutdownTimeoutMs,
          diagnostics: {
            warnOnExportFailure: config.diagnostics.warnOnExportFailure,
          },
        },
      );
    }
  }

  getRegistry() {
    return this.registry;
  }

  getFullSnapshot() {
    return this.registry.snapshot();
  }

  getCardinalitySnapshot() {
    return this.registry.cardinalitySnapshot();
  }

  getSchedulerSnapshot() {
    return this.scheduler?.snapshot();
  }

  init(): void {}
  start(): void {
    this.runtimeCollector?.start();
    this.scheduler?.start();
  }
  async stop(): Promise<void> {
    this.runtimeCollector?.stop();
    await this.scheduler?.shutdown();
  }

  private buildExporter(): Exporter<MetricsSnapshot> {
    const { config } = this.ctx;
    const exportCfg = config.export;
    const metricSignalCfg = config.export?.signals?.metrics;
    // Wrap with retry + circuit breaker
    const retryCfg = metricSignalCfg?.retry ?? exportCfg.retry;
    const circuitCfg =
      metricSignalCfg?.circuitBreaker ?? exportCfg.circuitBreaker;

    const wrapped = ExporterBuilder.from(this.getSink())
      .withRetry(retryCfg)
      .withCircuitBreaker(circuitCfg)
      .build();
    return wrapped;
  }

  private getSink(): Exporter<MetricsSnapshot> {
    const config = this.ctx.config;
    const exportCfg = config.export;
    const metricSignalCfg = config.export?.signals?.metrics;

    // Export is disabled at the global or signal level — swallow everything silently.
    if (!exportCfg.enabled || !(metricSignalCfg?.enabled ?? true)) {
      return new NoopExporter();
    }
    const destination = metricSignalCfg?.destination ?? exportCfg.destination;

    switch (destination.type) {
      case 'console':
        return new ConsoleExporter(
          'metrics',
          new MetricsConsoleFormatter(),
          true,
        );
      case 'file':
        return new FileExporter(
          destination.filePath,
          new MetricsFileFormatter(),
        );
      case 'otlp-http':
        return new OtlpHttpExporter(
          {
            endpoint: destination.resolvedEndpoints.metrics,
            headers: destination.headers,
            timeoutMs: destination.timeoutMs,
          },
          new MetricsOtlpFormatter({
            serviceName: config.serviceName,
            version: '1.0.0',
          }),
        );
      default:
        return new NoopExporter();
    }
  }
}
