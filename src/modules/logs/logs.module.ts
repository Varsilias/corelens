import { Module, NormalisedExportDestination } from '../../core/config';
import { ModuleContext } from '../../core/config';
import {
  LogsConsoleFormatter,
  LogsFileFormatter,
  LogsOtlpFormatter,
} from '../../core/logger/formatter';
import {
  IPipeline,
  LogsPipeline,
  NoopPipeline,
} from '../../core/logger/pipeline';
import { TeePipeline } from '../../core/logger/tee-pipeline';
import { CorelensWriter } from '../../core/logger/writer';
import { CircuitBreakerExporter } from '../../exporters/circuit-breaker';
import { FileExporter } from '../../exporters/file';
import { NoopExporter } from '../../exporters/noop';
import { OtlpHttpExporter } from '../../exporters/otlp-http';
import { RetryingTraceExporter } from '../../exporters/retry';

export class LogsModule implements Module {
  private pipeline: IPipeline;

  constructor(private ctx: ModuleContext) {
    const { config } = this.ctx;

    if (!config.logs.enabled) {
      this.pipeline = new NoopPipeline();
      return;
    }

    const isPretty = config.logs.format === 'pretty';
    const colorize = config.logs.colorize;

    const stdoutFormatter = new LogsConsoleFormatter({
      prettyEnabled: isPretty,
      colorize,
    });

    const writer = new CorelensWriter({ highWaterMark: 64 * 1024 });
    this.pipeline = new LogsPipeline({
      writer,
      maxQueueBytes: config.logs.maxQueueBytes ?? 1 * 1024 * 1024,
      fullQueuePolicy: config.logs.fullQueuePolicy,
      formatter: stdoutFormatter,
    });

    // Secondary sink — wired only when export is enabled and configured.
    // stdout is always the primary; this runs alongside it unless the
    // destination IS console, in which case we skip to avoid double-writing.
    const exportCfg = config.export;
    const logSignalCfg = config.export?.signals?.logs;
    const exportEnabled = exportCfg?.enabled && (logSignalCfg?.enabled ?? true);

    if (exportEnabled) {
      this.attachExportSink(isPretty, colorize);
    }
  }

  getPipeline() {
    return this.pipeline;
  }

  getPipelineStats() {
    return this.pipeline.getStats();
  }

  init(): void {}
  start(): void {}
  async stop(): Promise<void> {
    await this.pipeline.flushAll();
  }

  private attachExportSink(isPretty: boolean, colorize: boolean): void {
    const { config } = this.ctx;
    const exportCfg = config.export;
    const logSignalCfg = config.export?.signals?.logs;
    const destination = logSignalCfg?.destination ?? exportCfg.destination;

    // Console destination === stdout, which the primary pipeline already covers.
    if (destination.type === 'console') return;

    const exporter = this.buildExporter(destination, isPretty, colorize);

    // Wrap with retry + circuit breaker, same as traces and metrics.
    const logSignalRetry = logSignalCfg?.retry;
    const logSignalCircuit = logSignalCfg?.circuitBreaker;

    const retryConfig = {
      maxRetries: logSignalRetry?.maxRetries ?? exportCfg.retry.maxRetries,
      initialDelayMs:
        logSignalRetry?.initialDelayMs ?? exportCfg.retry.initialDelayMs,
      maxDelayMs: logSignalRetry?.maxDelayMs ?? exportCfg.retry.maxDelayMs,
    };

    const circuitConfig = {
      threshold:
        logSignalCircuit?.failureThreshold ??
        exportCfg.circuitBreaker.failureThreshold,
      resetTimeoutMs:
        logSignalCircuit?.resetTimeoutMs ??
        exportCfg.circuitBreaker.resetTimeoutMs,
    };
    const wrapped = new CircuitBreakerExporter(
      new RetryingTraceExporter(exporter, retryConfig),
      circuitConfig,
    );

    const teeConfig = {
      maxQueueSize:
        logSignalCfg?.batch?.maxQueueSize ?? exportCfg.batch.maxQueueSize,
      maxExportBatchSize:
        logSignalCfg?.batch?.maxExportBatchSize ??
        exportCfg.batch.maxExportBatchSize,
      scheduledDelayMs:
        logSignalCfg?.batch?.scheduledDelayMs ??
        exportCfg.batch.scheduledDelayMs,
      shutdownTimeoutMs:
        logSignalCfg?.batch?.shutdownTimeoutMs ??
        exportCfg.batch.shutdownTimeoutMs,
      fullQueuePolicy:
        logSignalCfg?.batch?.fullQueuePolicy ?? exportCfg.batch.fullQueuePolicy,
      diagnostics: {
        warnOnExportFailure: config.diagnostics.warnOnExportFailure,
      },
    };
    // Tee the pipeline: every log event goes to stdout AND the export sink.
    this.pipeline = new TeePipeline(this.pipeline, wrapped, teeConfig);
  }

  private buildExporter(
    destination: NormalisedExportDestination,
    isPretty: boolean,
    colorize: boolean,
  ) {
    const { config } = this.ctx;

    switch (destination.type) {
      case 'file':
        return new FileExporter(
          destination.filePath,
          new LogsFileFormatter({ prettyEnabled: isPretty, colorize }),
        );

      case 'otlp-http':
        return new OtlpHttpExporter(
          {
            endpoint: destination.endpoint,
            headers: destination.headers,
            timeoutMs: destination.timeoutMs,
          },
          new LogsOtlpFormatter({
            serviceName: config.serviceName,
            version: '1.0.0',
          }),
        );

      default:
        return new NoopExporter();
    }
  }
}
