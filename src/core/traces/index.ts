import { AsyncLocalStorage, AsyncResource } from 'node:async_hooks';
import { randomBytes } from 'node:crypto';
import { ISpan, NoopSpan, Span, SpanKind, StartSpanOptions } from './span';
import { InMemorySpanProcessor } from './processor';

export type TraceContext = {
  traceId: string;
  spanId: string;
  parentSpanId: string | null;
  sampled: boolean;
};

export type ContextProvider = {
  getTraceContext(): TraceContext | undefined;
};

export interface ITracer {
  getTraceContext(): TraceContext | undefined;
  startSpan(name: string): ISpan;
  startSpanWithOptions(options: StartSpanOptions): ISpan;
  withSpan<R>(name: string, fn: (span: ISpan) => R): R;
  getActiveSpan(): ISpan | undefined;
  runInContext<R>(span: ISpan, fn: () => R): R;
  bindToContext<T extends (...args: any[]) => any>(fn: T): T;
  enterWithSpan(span: ISpan): void;
  shouldSample(
    parentContext: TraceContext | undefined,
    samplingRate: number,
  ): boolean;
}

export class Tracer implements ContextProvider, ITracer {
  private readonly serviceName: string;
  private readonly samplingRate: number = 1;
  constructor(
    private readonly store: TraceContextStore,
    private readonly generator: TraceIdGenerator,
    private readonly processor: InMemorySpanProcessor,
    config: { serviceName: string; samplingRate: number },
  ) {
    this.serviceName = config.serviceName;
    this.samplingRate = config.samplingRate;
  }

  getTraceContext(): TraceContext | undefined {
    const span = this.store.getActiveSpan();
    if (!span) return undefined;

    return {
      traceId: span.getTraceId(),
      spanId: span.getSpanId(),
      parentSpanId: span.getParentSpanId(),
      sampled: span.isSampled(),
    };
  }

  startSpan(name: string): ISpan {
    return this.startSpanWithOptions({ name });
  }

  startSpanWithOptions(options: StartSpanOptions): ISpan {
    const activeContext = this.getTraceContext();

    const parentContext = options.parentContext ?? activeContext;
    const traceId = parentContext?.traceId ?? this.generator.generateTraceId();
    const spanId = this.generator.generateSpanId();
    const sampled = this.shouldSample(parentContext);

    const span = new Span(
      options.name,
      traceId,
      spanId,
      parentContext?.spanId ?? null,
      (s) => this.processor.onEnd(s),
      options.kind ?? SpanKind.INTERNAL,
      options.attributes,
      sampled,
    );

    span.setAttribute('service.name', this.serviceName);

    return span;
  }

  enterWithSpan(span: ISpan): void {
    return this.store.enterWith(span);
  }

  withSpan<R>(name: string, fn: (span: ISpan) => R): R {
    const span = this.startSpanWithOptions({ name });
    return this.store.run(span, () => {
      try {
        const result = fn(span);

        // Check if the result is a Promise (is it "thenable"?)
        if (result instanceof Promise) {
          return result
            .catch((error) => {
              span.recordException(error);
              throw error;
            })
            .finally(() => span.end()) as R;
        }

        // If it's sync, end the span and return the result immediately
        span.end();
        return result;
      } catch (error) {
        // Catch sync errors
        span.recordException(error);
        span.end();
        throw error;
      }
    });
  }

  runInContext<R>(span: ISpan, fn: () => R): R {
    return this.store.run(span, fn);
  }

  bindToContext<T extends (...args: any[]) => any>(fn: T): T {
    return this.store.bind(fn);
  }

  getActiveSpan(): ISpan | undefined {
    return this.store.getActiveSpan();
  }

  /**Future implementation could include:
   * always sample errorr
    sample specific routes
    sample slow requests
    debug-force sampling
    trust or ignore remote parent
   */
  /**
   *
   * @param parentContext
   * @param samplingRate
   * @returns
   */
  shouldSample(parentContext: TraceContext | undefined): boolean {
    if (parentContext) {
      return parentContext.sampled;
    }

    return Math.random() < this.samplingRate;
  }
}

export class NoopTracer implements ITracer {
  getTraceContext(): TraceContext | undefined {
    return undefined;
  }
  startSpan(name: string): ISpan {
    return new NoopSpan(name);
  }

  withSpan<R>(name: string, fn: (span: ISpan) => R): R {
    return fn(new NoopSpan(name));
  }
  getActiveSpan(): ISpan | undefined {
    return undefined;
  }

  runInContext<R>(span: ISpan, fn: () => R): R {
    return fn();
  }
  bindToContext<T extends (...args: any[]) => any>(fn: T): T {
    return AsyncResource.bind(fn);
  }

  startSpanWithOptions(options: StartSpanOptions): ISpan {
    return new NoopSpan(options.name);
  }

  enterWithSpan(span: ISpan): void {}

  shouldSample(
    parentContext: TraceContext | undefined,
    samplingRate: number,
  ): boolean {
    return false;
  }
}

export class TraceContextStore {
  private storage = new AsyncLocalStorage<ISpan>();

  run<R>(span: ISpan, fn: () => R): R {
    return this.storage.run(span, fn);
  }
  getActiveSpan(): ISpan | undefined {
    return this.storage.getStore();
  }

  enterWith(span: ISpan) {
    return this.storage.enterWith(span);
  }

  bind<T extends (...args: any[]) => any>(fn: T): T {
    const span = this.getActiveSpan();
    if (!span) return fn;

    return ((...args: Parameters<T>) => {
      return this.run(span, () => fn(...args));
    }) as T;
  }
}

export class TraceIdGenerator {
  generateTraceId(): string {
    return randomBytes(16).toString('hex');
  }
  generateSpanId(): string {
    return randomBytes(8).toString('hex');
  }
}
