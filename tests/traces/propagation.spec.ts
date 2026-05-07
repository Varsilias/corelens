import { W3CTraceContextPropagator } from '../../src/core/traces/propagator';

describe('w3c trace context propagation', () => {
  it('parses valid sampled traceparent headers', () => {
    expect(
      W3CTraceContextPropagator.parseTraceParent(
        '00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01',
      ),
    ).toEqual({
      traceId: '4bf92f3577b34da6a3ce929d0e0e4736',
      spanId: '00f067aa0ba902b7',
      sampled: true,
      parentSpanId: null,
    });
  });

  it('parses valid unsampled traceparent headers', () => {
    expect(
      W3CTraceContextPropagator.parseTraceParent(
        '00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-00',
      )?.sampled,
    ).toBe(false);
  });

  it.each([
    undefined,
    '',
    'bad',
    '01-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01',
    '00-00000000000000000000000000000000-00f067aa0ba902b7-01',
    '00-4bf92f3577b34da6a3ce929d0e0e4736-0000000000000000-01',
    '00-zzzz2f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01',
  ])('rejects invalid traceparent %#', (value) => {
    expect(W3CTraceContextPropagator.parseTraceParent(value)).toBeUndefined();
  });

  it('formats trace context using the active span id and sampled flag', () => {
    expect(
      W3CTraceContextPropagator.format({
        traceId: '4bf92f3577b34da6a3ce929d0e0e4736',
        spanId: '00f067aa0ba902b7',
        parentSpanId: '1111111111111111',
        sampled: false,
      }),
    ).toBe('00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-00');
  });
});
