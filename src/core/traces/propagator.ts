import { TraceContext } from '.';

type RemoteTraceContext = {
  traceId: string;
  parentSpanId: string;
  sampled: boolean;
};

export class W3CTraceContextPropagator {
  static defaultTraceParent =
    '00-00000000000000000000000000000000-0000000000000000-00';
  /**
   * Parses the 'traceparent' header.
   * Format: 00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01
   */
  static parseTraceParent(value: unknown): TraceContext | undefined {
    if (!value) return undefined;

    const header = Array.isArray(value) ? value[0] : value;

    if (typeof header !== 'string') return undefined;

    const parts = header.trim().split('-');

    if (parts.length !== 4) return undefined;

    const [version, traceId, spanId, flags] = parts;

    if (version !== '00') return undefined;
    if (!/^[0-9a-f]{32}$/.test(traceId)) return undefined;
    if (!/^[0-9a-f]{16}$/.test(spanId)) return undefined;
    if (!/^[0-9a-f]{2}$/.test(flags)) return undefined;

    if (traceId === '00000000000000000000000000000000') return undefined;
    if (spanId === '0000000000000000') return undefined;

    return {
      traceId,
      spanId,
      sampled: (parseInt(flags, 16) & 1) === 1,
      parentSpanId: null,
    };
  }
  /**
   * Formats the context into a 'traceparent' string for outbound calls.
   */
  static format(ctx: TraceContext): string {
    const flags = ctx.sampled ? '01' : '00';

    return `00-${ctx.traceId}-${ctx.spanId}-${flags}`;
  }
}
