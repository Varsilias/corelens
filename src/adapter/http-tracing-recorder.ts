import { ITracer } from '../core/traces';
import { ISpan, SpanKind } from '../core/traces/span';
import { W3CTraceContextPropagator } from '../core/traces/propagator';

type HttpTracingAdapterOptions = {
  enabled: boolean;
  ignoredRoutes?: string[];
};
export interface HttpTracingAdapter<TApp> {
  register(app: TApp, recorder: HttpTracingRecorder): void;
}

export class HttpTracingRecorder {
  private readonly ignoredRoutes: Set<string>;

  constructor(
    private tracer: ITracer,
    private readonly config: HttpTracingAdapterOptions,
  ) {
    this.ignoredRoutes = new Set(config.ignoredRoutes ?? []);
  }

  get isEnabled(): boolean {
    return this.config.enabled;
  }

  start(data: {
    method: string;
    route: string;
    target: string;
    protocol?: string;
    userAgent?: string;
    traceparent?: string;
  }) {
    if (!this.isEnabled || this.ignoredRoutes.has(data.route)) {
      return;
    }
    const parentContext = W3CTraceContextPropagator.parseTraceParent(
      data.traceparent,
    );

    const attributes = {
      'http.method': data.method,
      'http.route': data.route,
      'http.target': data.target,
      'http.scheme': data.protocol ?? '',
      'http.user_agent': data.userAgent ?? '',
    };

    return this.tracer.startSpanWithOptions({
      name: `${data.method} ${data.route}`,
      kind: SpanKind.SERVER,
      parentContext,
      attributes,
    });
  }

  runWithSpan<T>(span: ISpan | undefined, fn: () => T): T {
    if (!span) {
      return fn();
    }

    return this.tracer.runInContext(span, fn);
  }

  enterWithSpan(span: ISpan | undefined): void {
    if (!span) {
      return;
    }

    this.tracer.enterWithSpan(span);
  }

  end(span: ISpan | undefined, data: { status: number }): void {
    if (!span) {
      return;
    }

    span.setAttribute('http.status_code', String(data.status));

    if (data.status >= 500) {
      span.setStatus('error');
    }

    span.end();
  }
}
