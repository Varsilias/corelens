import { Module } from '../../core/config';
import { ModuleContext } from '../../core/config';
import { TraceContextStore, TraceIdGenerator, Tracer } from '../../core/traces';
import {
  CircuitBreakerExporter,
  ConsoleExporter,
  FileTraceExporter,
  RetryingTraceExporter,
} from '../../core/traces/exporters';
import {
  BatchSpanProcessor,
  InMemorySpanProcessor,
} from '../../core/traces/processor';
import { SpanProcessor, TraceExporter } from '../../core/traces/span';

export class TracesModule implements Module {
  private contextStore: TraceContextStore;
  private tracer: Tracer;
  private generator: TraceIdGenerator;
  private processor: SpanProcessor;
  private exporter: TraceExporter;

  constructor(private ctx: ModuleContext) {
    const { config } = this.ctx;
    this.contextStore = new TraceContextStore();
    this.generator = new TraceIdGenerator();

    // this.exporter = new ConsoleExporter();
    // this.processor = new InMemorySpanProcessor(
    //   {
    //     fullQueuePolicy: config.traces.batch.fullQueuePolicy,
    //     maxQueueSize: config.traces.batch.maxQueueSize,
    //   },
    //   this.exporter,
    // );

    const retryConfig = {
      maxRetries: config.export.retry.maxRetries,
      initialDelayMs: config.export.retry.initialDelayMs,
      maxDelayMs: config.export.retry.maxDelayMs,
    };

    const circuitConfig = {
      threshold: config.export.circuitBreaker.failureThreshold,
      resetTimeoutMs: config.export.circuitBreaker.resetTimeoutMs,
    };

    this.exporter = new CircuitBreakerExporter(
      new RetryingTraceExporter(
        new FileTraceExporter('trace.log'),
        retryConfig,
      ),
      circuitConfig,
    );

    this.processor = new BatchSpanProcessor(this.exporter, {
      fullQueuePolicy: config.export.batch.fullQueuePolicy,
      maxExportBatchSize: config.export.batch.maxExportBatchSize,
      maxQueueSize: config.export.batch.maxQueueSize,
      scheduledDelayMs: config.export.batch.scheduledDelayMs,
      shutdownTimeoutMs: 3000,
    });

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
}
