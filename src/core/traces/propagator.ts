import { TraceContext } from '.';

type RemoteTraceContext = {
  traceId: string;
  parentSpanId: string;
  sampled: boolean;
};

export class W3CTraceContextPropagator {
  /**
   * Parses the 'traceparent' header.
   * Format: 00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01
   */
  parse(traceparent: string): RemoteTraceContext | null {
    if (!traceparent) return null;

    const parts = traceparent.split('-');

    // W3C spec: version-traceId-spanId-flags
    // Version must be '00', total 4 parts.
    if (parts.length !== 4 || parts[0] !== '00') {
      return null;
    }

    const [version, traceId, parentSpanId, flags] = parts;

    // Validate lengths
    if (traceId.length !== 32 || parentSpanId.length !== 16) {
      return null;
    }

    return {
      traceId,
      parentSpanId: parentSpanId,
      sampled: flags === '01',
    };
  }
  /**
   * Formats the context into a 'traceparent' string for outbound calls.
   */
  format(ctx: TraceContext): string {
    const { traceId, spanId, sampled } = ctx;
    const isHex = (str: string) => /^[0-9a-fA-F]+$/.test(str);

    // sanity check for W3C spec
    if (
      traceId.length !== 32 ||
      !isHex(traceId) ||
      spanId.length !== 16 ||
      !isHex(spanId)
    )
      return '';

    const flags = sampled ? '01' : '00';

    return `00-${traceId}-${spanId}-${flags}`;
  }
}
