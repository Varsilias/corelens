import {
  OTLPAttribute,
  OTLPSignalRequest,
  OTLPSpan,
  OTLPSpanEvent,
} from '../../otlp/types';
import { SignalFormatter } from '../config';
import {
  mapKindToOtlpValue,
  SpanAttribute,
  SpanEvent,
  TraceSnapshot,
} from './span';

export class TraceConsoleFormatter implements SignalFormatter<
  TraceSnapshot,
  string
> {
  format(record: TraceSnapshot): string {
    return JSON.stringify(record);
  }
}

export class TraceFileFormatter implements SignalFormatter<
  TraceSnapshot,
  string
> {
  format(record: TraceSnapshot): string {
    return JSON.stringify(record);
  }
}

export class TraceOtlpFormatter implements SignalFormatter<
  TraceSnapshot,
  OTLPSignalRequest
> {
  constructor(
    private readonly config: {
      serviceName: string;
      version: string;
    },
  ) {}
  format(spans: TraceSnapshot[]): OTLPSignalRequest {
    return {
      resourceSpans: [
        {
          resource: {
            attributes: [
              {
                key: 'service.name',
                value: { stringValue: this.config.serviceName },
              },
            ],
          },
          scopeSpans: [
            {
              scope: { name: 'corelens', version: this.config.version },
              spans: spans.map((s) => this.formatSpan(s)),
            },
          ],
        },
      ],
    };
  }

  private formatSpan(span: TraceSnapshot): OTLPSpan {
    return {
      traceId: span.traceId.toUpperCase(),
      spanId: span.spanId.toUpperCase(),
      ...(span.parentSpanId
        ? { parentSpanId: span.parentSpanId.toUpperCase() }
        : {}),
      name: span.name,
      startTimeUnixNano: (span.startTimeEpoch * 1_000_000).toString(),
      endTimeUnixNano: (span.endTimeEpoch * 1_000_000).toString(),
      kind: mapKindToOtlpValue(span.kind),
      status: {
        code: span.status === 'ok' ? 1 : span.status === 'error' ? 2 : 0,
      },
      attributes: this.formatAttributes(span.attributes),
      events: this.formatEvent(span.events),
    };
  }

  private formatEvent(events: SpanEvent[]): OTLPSpanEvent[] {
    const result: OTLPSpanEvent[] = [];
    for (const e of events) {
      result.push({
        name: e.name,
        timeUnixNano: (e.timeUnixNano * 1_000_000).toString(),
        attributes: this.formatAttributes(e.attributes),
      });
    }

    return result;
  }

  private formatAttributes(attrs: SpanAttribute): OTLPAttribute[] {
    const result: OTLPAttribute[] = [];
    for (const key in attrs) {
      if (key === 'service.name') continue; // already hoisted to resource, no need to repeat
      result.push({ key, value: this.formatValue(attrs[key]) });
    }
    return result;
  }

  private formatValue(value: unknown) {
    if (typeof value === 'string') return { stringValue: value };
    if (typeof value === 'boolean') return { boolValue: value };
    if (typeof value === 'number') {
      return Number.isInteger(value)
        ? { intValue: value.toString() }
        : { doubleValue: value };
    }

    return { stringValue: String(value) };
  }
}
