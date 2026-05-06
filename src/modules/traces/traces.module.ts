import { Module } from '../../core/config';
import { ModuleContext } from '../../core/config';
import { TraceContextStore, TraceIdGenerator, Tracer } from '../../core/traces';
import {
  TraceConsoleFormatter,
  TraceFileFormatter,
  TraceOtlpFormatter,
} from '../../core/traces/formatter';
import {
  BatchSpanProcessor,
  SimpleSpanProcessor,
} from '../../core/traces/processor';
import {
  SpanProcessor,
  TraceExporter,
  TraceSnapshot,
} from '../../core/traces/span';
import { CircuitBreakerExporter } from '../../exporters/circuit-breaker';
import { ConsoleExporter } from '../../exporters/console';
import { FileExporter } from '../../exporters/file';
import { NoopExporter } from '../../exporters/noop';
import { OtlpHttpExporter } from '../../exporters/otlp-http';
import { RetryingTraceExporter } from '../../exporters/retry';
import { Exporter } from '../../exporters/types';

export class TracesModule implements Module {
  private contextStore: TraceContextStore;
  private tracer: Tracer;
  private generator: TraceIdGenerator;
  private processor: SpanProcessor;
  private exporter: Exporter<TraceSnapshot>;

  constructor(private ctx: ModuleContext) {
    const { config } = this.ctx;
    this.contextStore = new TraceContextStore();
    this.generator = new TraceIdGenerator();

    const exportCfg = config.export;
    const traceSignalCfg = config.export?.signals?.traces;

    const retryConfig = {
      maxRetries:
        traceSignalCfg?.retry?.maxRetries ?? exportCfg.retry.maxRetries,
      initialDelayMs:
        traceSignalCfg?.retry?.initialDelayMs ?? exportCfg.retry.initialDelayMs,
      maxDelayMs:
        traceSignalCfg?.retry?.maxDelayMs ?? exportCfg.retry.maxDelayMs,
    };

    const circuitConfig = {
      threshold:
        traceSignalCfg?.circuitBreaker?.failureThreshold ??
        exportCfg.circuitBreaker.failureThreshold,
      resetTimeoutMs:
        traceSignalCfg?.circuitBreaker?.resetTimeoutMs ??
        exportCfg.circuitBreaker.resetTimeoutMs,
    };

    this.exporter = new CircuitBreakerExporter(
      new RetryingTraceExporter(this.getSink(), retryConfig),
      circuitConfig,
    );

    this.processor = this.getProcessor(this.exporter);

    this.tracer = new Tracer(
      this.contextStore,
      this.generator,
      this.processor,
      {
        serviceName: config.serviceName,
        samplingRate: config.traces.samplingRate,
      },
    );
  }

  getTracer() {
    return this.tracer;
  }

  snapshot() {
    return this.processor.snapshot();
  }

  getFinishedSpans({ limit }: { limit: number }) {
    return this.processor.getFinishedSpans(limit);
  }

  init(): void {}

  start(): void {}

  async stop(): Promise<void> {
    await this.processor.shutdown();
  }

  private getProcessor(exporter: Exporter<TraceSnapshot>) {
    const config = this.ctx.config;
    const exportCfg = config.export;
    const traceSignalCfg = config.export?.signals?.traces;
    const mode = traceSignalCfg?.mode ?? exportCfg.mode;

    if (mode) {
      return new SimpleSpanProcessor(
        {
          diagnostics: {
            warnOnExportFailure: config.diagnostics.warnOnExportFailure,
          },
        },
        exporter,
      );
    }

    const batchCfg = {
      fullQueuePolicy:
        traceSignalCfg?.batch?.fullQueuePolicy ??
        exportCfg.batch.fullQueuePolicy,
      maxExportBatchSize:
        traceSignalCfg?.batch?.maxExportBatchSize ??
        exportCfg.batch.maxExportBatchSize,
      maxQueueSize:
        traceSignalCfg?.batch?.maxQueueSize ?? exportCfg.batch.maxQueueSize,
      scheduledDelayMs:
        traceSignalCfg?.batch?.scheduledDelayMs ??
        exportCfg.batch.scheduledDelayMs,
      shutdownTimeoutMs:
        traceSignalCfg?.batch?.shutdownTimeoutMs ??
        exportCfg.batch.shutdownTimeoutMs,
    };
    return new BatchSpanProcessor(this.exporter, batchCfg);
  }

  private getSink(): Exporter<TraceSnapshot> {
    const config = this.ctx.config;
    const exportCfg = config.export;
    const traceSignalCfg = config.export?.signals?.traces;

    // Export is disabled at the global or signal level — swallow everything silently.
    if (!exportCfg.enabled || !(traceSignalCfg?.enabled ?? true)) {
      return new NoopExporter();
    }
    const destination = traceSignalCfg?.destination ?? exportCfg.destination;
    const sink = destination.type;

    switch (sink) {
      case 'console':
        return new ConsoleExporter('traces', new TraceConsoleFormatter(), true);
      case 'file':
        return new FileExporter(destination.filePath, new TraceFileFormatter());
      case 'otlp-http':
        return new OtlpHttpExporter(
          {
            endpoint: destination.resolvedEndpoints.traces,
            headers: destination.headers,
            timeoutMs: destination.timeoutMs,
          },
          new TraceOtlpFormatter({
            serviceName: config.serviceName,
            version: '1.0.0',
          }),
        );

      default:
        return new NoopExporter();
    }
  }
}
