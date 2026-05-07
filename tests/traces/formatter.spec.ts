import { TraceOtlpFormatter } from '../../src/core/traces/formatter';
import { SpanKind, TraceSnapshot } from '../../src/core/traces/span';
import { OTLPTraceRequest } from '../../src/otlp/types';

function span(overrides: Partial<TraceSnapshot> = {}): TraceSnapshot {
  return {
    name: 'GET /users',
    traceId: '4bf92f3577b34da6a3ce929d0e0e4736',
    spanId: '00f067aa0ba902b7',
    parentSpanId: '1111111111111111',
    startTime: 1,
    startTimeEpoch: 1_700_000_000_000,
    endTime: 2,
    endTimeEpoch: 1_700_000_000_010,
    durationMs: 1,
    status: 'ok',
    attributes: {
      route: '/users/:id',
      retry: 2,
      cached: false,
    },
    events: [
      {
        name: 'db.query',
        timeUnixNano: 1_700_000_000_005,
        attributes: { rows: 3 },
      },
    ],
    kind: SpanKind.SERVER,
    ...overrides,
  };
}

describe('trace otlp formatter', () => {
  it('places service.name at resource level and maps span fields', () => {
    const formatted = new TraceOtlpFormatter({
      serviceName: 'api',
      version: '1.0.0',
    }).format([span()]) as OTLPTraceRequest;
    const resource = formatted.resourceSpans[0];
    const otlpSpan = resource.scopeSpans[0].spans[0];

    expect(resource.resource.attributes).toContainEqual({
      key: 'service.name',
      value: { stringValue: 'api' },
    });
    expect(otlpSpan).toMatchObject({
      traceId: '4BF92F3577B34DA6A3CE929D0E0E4736',
      spanId: '00F067AA0BA902B7',
      parentSpanId: '1111111111111111',
      name: 'GET /users',
      startTimeUnixNano: '1700000000000000000',
      endTimeUnixNano: '1700000000010000000',
      kind: 2,
      status: { code: 1 },
    });
  });

  it('preserves string, number, and boolean attributes', () => {
    const otlpSpan = (
      new TraceOtlpFormatter({
        serviceName: 'api',
        version: '1.0.0',
      }).format([span()]) as OTLPTraceRequest
    ).resourceSpans[0].scopeSpans[0].spans[0];

    expect(otlpSpan.attributes).toEqual(
      expect.arrayContaining([
        { key: 'route', value: { stringValue: '/users/:id' } },
        { key: 'retry', value: { intValue: '2' } },
        { key: 'cached', value: { boolValue: false } },
      ]),
    );
    expect(otlpSpan.events[0].attributes).toContainEqual({
      key: 'rows',
      value: { intValue: '3' },
    });
  });

  it('maps error and unset statuses to OTLP status codes', () => {
    const formatter = new TraceOtlpFormatter({
      serviceName: 'api',
      version: '1.0.0',
    });

    expect(
      (formatter.format([span({ status: 'error' })]) as OTLPTraceRequest)
        .resourceSpans[0].scopeSpans[0].spans[0].status.code,
    ).toBe(2);
    expect(
      (formatter.format([span({ status: 'unset' })]) as OTLPTraceRequest)
        .resourceSpans[0].scopeSpans[0].spans[0].status.code,
    ).toBe(0);
  });
});
