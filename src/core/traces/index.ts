import { AsyncLocalStorage, AsyncResource } from 'node:async_hooks';
import { randomBytes } from 'node:crypto';
import { ISpan, NoopSpan, Span } from './span';
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
  withSpan<R>(name: string, fn: (span: ISpan) => R): R;
  getActiveSpan(): ISpan | undefined;
  runInContext<R>(span: ISpan, fn: () => R): R;
  bindToContext<T extends (...args: any[]) => any>(fn: T): T;
  getDebugId(): string;
}

export class Tracer implements ContextProvider, ITracer {
  private readonly serviceName: string;
  constructor(
    private readonly store: TraceContextStore,
    private readonly generator: TraceIdGenerator,
    private readonly processor: InMemorySpanProcessor,
    config: { serviceName: string },
  ) {
    this.serviceName = config.serviceName;
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

  getDebugId() {
    return this.store.id;
  }

  startSpan(name: string): ISpan {
    const parent = this.store.getActiveSpan();

    const traceId = parent
      ? parent.getTraceId()
      : this.generator.generateTraceId();
    const parentSpanId = parent ? parent.getSpanId() : null;
    const spanId = this.generator.generateSpanId();

    const span = new Span(name, traceId, spanId, parentSpanId, (s) =>
      this.processor.onEnd(s),
    );

    span.setAttribute('service.name', this.serviceName);

    return span;
  }

  withSpan<R>(name: string, fn: (span: ISpan) => R): R {
    const span = this.startSpan(name);
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
  getDebugId(): string {
    return '';
  }
}

export class TraceContextStore {
  public readonly id = Math.random().toString(16).slice(2);
  private storage = new AsyncLocalStorage<ISpan>();

  run<R>(span: ISpan, fn: () => R): R {
    return this.storage.run(span, fn);
  }
  getActiveSpan(): ISpan | undefined {
    return this.storage.getStore();
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
