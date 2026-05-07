import {
  TraceContextStore,
  TraceIdGenerator,
  Tracer,
} from '../../src/core/traces';
import { Span, SpanKind, SpanProcessor } from '../../src/core/traces/span';

class DeterministicGenerator extends TraceIdGenerator {
  private span = 0;

  generateTraceId(): string {
    return 'a'.repeat(32);
  }

  generateSpanId(): string {
    this.span++;
    return this.span.toString(16).padStart(16, '0');
  }
}

function processor(): SpanProcessor & {
  starts: Span[];
  ends: Span[];
} {
  return {
    starts: [],
    ends: [],
    onStart(span: Span) {
      this.starts.push(span);
    },
    onEnd(span: Span) {
      this.ends.push(span);
    },
    forceFlush: jest.fn().mockResolvedValue(undefined),
    shutdown: jest.fn().mockResolvedValue(undefined),
    snapshot: jest.fn(() => ({})),
    getFinishedSpans: jest.fn(() => []),
  };
}

describe('tracer', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('notifies the processor when sampled spans start and end', () => {
    const p = processor();
    const tracer = new Tracer(
      new TraceContextStore(),
      new DeterministicGenerator(),
      p,
      { serviceName: 'api', samplingRate: 1 },
    );

    const span = tracer.startSpanWithOptions({
      name: 'operation',
      kind: SpanKind.SERVER,
    });
    span.end();

    expect(p.starts).toHaveLength(1);
    expect(p.ends).toHaveLength(1);
    expect(p.ends[0].toJSON()).toMatchObject({
      name: 'operation',
      kind: SpanKind.SERVER,
      traceId: 'a'.repeat(32),
      spanId: '0000000000000001',
      parentSpanId: null,
      status: 'ok',
    });
  });

  it('propagates unsampled parent context but does not sample the child span', () => {
    const p = processor();
    const tracer = new Tracer(
      new TraceContextStore(),
      new DeterministicGenerator(),
      p,
      { serviceName: 'api', samplingRate: 1 },
    );

    const span = tracer.startSpanWithOptions({
      name: 'GET /users',
      parentContext: {
        traceId: 'b'.repeat(32),
        spanId: 'c'.repeat(16),
        parentSpanId: null,
        sampled: false,
      },
    });

    expect(span.getTraceId()).toBe('b'.repeat(32));
    expect(span.getParentSpanId()).toBe('c'.repeat(16));
    expect(span.isSampled()).toBe(false);
  });

  it('keeps async context isolated across concurrent spans', async () => {
    const p = processor();
    const tracer = new Tracer(
      new TraceContextStore(),
      new DeterministicGenerator(),
      p,
      { serviceName: 'api', samplingRate: 1 },
    );
    const seen: string[] = [];

    await Promise.all([
      tracer.withSpan('first', async () => {
        await new Promise((resolve) => setTimeout(resolve, 2));
        seen.push(tracer.getTraceContext()!.spanId);
      }),
      tracer.withSpan('second', async () => {
        seen.push(tracer.getTraceContext()!.spanId);
      }),
    ]);

    expect(seen.sort()).toEqual(['0000000000000001', '0000000000000002']);
  });

  it('uses the client span id in outbound traceparent headers', () => {
    const p = processor();
    const tracer = new Tracer(
      new TraceContextStore(),
      new DeterministicGenerator(),
      p,
      { serviceName: 'api', samplingRate: 1 },
    );

    tracer.withClientSpan(
      { name: 'HTTP GET', attributes: { 'http.method': 'GET' } },
      ({ span, traceparent }) => {
        expect(traceparent).toBe(
          `00-${span.getTraceId()}-${span.getSpanId()}-01`,
        );
      },
    );
  });
});
