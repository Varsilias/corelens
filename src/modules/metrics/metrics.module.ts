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
import { CircuitBreakerExporter } from '../../exporters/circuit-breaker';
import { RetryingTraceExporter } from '../../exporters/retry';
import { NoopExporter } from '../../exporters/noop';

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

    const retryConfig = {
      maxRetries:
        metricSignalCfg?.retry?.maxRetries ?? exportCfg.retry.maxRetries,
      initialDelayMs:
        metricSignalCfg?.retry?.initialDelayMs ??
        exportCfg.retry.initialDelayMs,
      maxDelayMs:
        metricSignalCfg?.retry?.maxDelayMs ?? exportCfg.retry.maxDelayMs,
    };

    const circuitConfig = {
      threshold:
        metricSignalCfg?.circuitBreaker?.failureThreshold ??
        exportCfg.circuitBreaker.failureThreshold,
      resetTimeoutMs:
        metricSignalCfg?.circuitBreaker?.resetTimeoutMs ??
        exportCfg.circuitBreaker.resetTimeoutMs,
    };

    this.exporter = new CircuitBreakerExporter(
      new RetryingTraceExporter(this.buildExporter(), retryConfig),
      circuitConfig,
    );

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
            endpoint: destination.endpoint,
            headers: destination.headers,
            timeoutMs: destination.timeoutMs,
          },
          new MetricsOtlpFormatter({
            serviceName: config.serviceName,
            version: '1.0.0',
          }),
        );
      default:
        throw new Error('Invalid destination type provided for metrics');
    }
  }
}
