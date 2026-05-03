import { Module } from '../../core/config';
import { ModuleContext } from '../../core/config';
import { TraceContextStore, TraceIdGenerator, Tracer } from '../../core/traces';
import { ConsoleExporter } from '../../core/traces/exporters';
import { InMemorySpanProcessor } from '../../core/traces/processor';
import { SpanProcessor, TraceExporter } from '../../core/traces/span';

export class TracesModule implements Module {
  private contextStore: TraceContextStore;
  private tracer: Tracer;
  private generator: TraceIdGenerator;
  private processor: SpanProcessor;
  private exporter: TraceExporter;

  constructor(private ctx: ModuleContext) {
    const { config } = ctx;
    this.contextStore = new TraceContextStore();
    this.generator = new TraceIdGenerator();
    this.exporter = new ConsoleExporter();
    this.processor = new InMemorySpanProcessor(
      {
        fullQueuePolicy: config.traces.batch.fullQueuePolicy,
        maxQueueSize: config.traces.batch.maxQueueSize,
      },
      this.exporter,
    );
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
