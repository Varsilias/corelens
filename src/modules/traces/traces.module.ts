import { Module } from '../../core/config';
import { ModuleContext } from '../../core/config';
import { TraceContextStore, TraceIdGenerator, Tracer } from '../../core/traces';
import { InMemorySpanProcessor } from '../../core/traces/processor';

export class TracesModule implements Module {
  private contextStore: TraceContextStore;
  private tracer: Tracer;
  private generator: TraceIdGenerator;
  private processor: InMemorySpanProcessor;

  constructor(private ctx: ModuleContext) {
    const { config } = ctx;
    this.contextStore = new TraceContextStore();
    this.generator = new TraceIdGenerator();
    this.processor = new InMemorySpanProcessor();
    this.tracer = new Tracer(
      this.contextStore,
      this.generator,
      this.processor,
      { serviceName: config.serviceName },
    );
  }

  getTracer() {
    return this.tracer;
  }

  snapshot() {
    return this.processor.snapshot();
  }

  init(): void {}
  start(): void {}
  async stop(): Promise<void> {}
}
