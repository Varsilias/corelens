import { once } from 'node:events';
import {
  mapKindToOtlpValue,
  SpanAttribute,
  SpanEvent,
  TraceExporter,
  TraceSnapshot,
} from './span';
import { appendFile } from 'node:fs/promises';
import {
  OTLPJSONRequestSchema,
  OTLPResourceAttribute,
  OTLPResourceSpan,
  OTLPSpan,
  OTLPSpanEvent,
} from '../../otlp/types';
import { OtlpHttpTransport } from '../../otlp/transport';

export class ConsoleExporter implements TraceExporter {
  constructor(private readonly maxSpansPerExport = 50) {}

  async export(spans: TraceSnapshot[]): Promise<void> {
    const batch = spans.slice(-this.maxSpansPerExport);

    for (const span of batch) {
      const line = JSON.stringify(span) + '\n';
      const canContinue = process.stdout.write(line);
      if (!canContinue) {
        await once(process.stdout, 'drain');
      }
    }

    const skipped = spans.length - batch.length;
    if (skipped > 0) {
      const canContinue = process.stderr.write(
        `[Corelens] ConsoleExporter skipped ${skipped} spans\n`,
      );

      if (!canContinue) {
        await once(process.stderr, 'drain');
      }
    }
  }

  async shutdown(): Promise<void> {}
}

enum CircuitState {
  CLOSED,
  OPEN,
  HALF_OPEN,
}

export class CircuitBreakerExporter implements TraceExporter {
  private state = CircuitState.CLOSED;
  private failureCount = 0;
  private lastFailureTime = 0;

  constructor(
    private readonly inner: TraceExporter,
    private config: {
      threshold: number;
      resetTimeoutMs: number;
    },
  ) {}

  async export(spans: TraceSnapshot[]): Promise<void> {
    if (this.state === CircuitState.OPEN) {
      if (Date.now() - this.lastFailureTime > this.config.resetTimeoutMs) {
        this.state = CircuitState.HALF_OPEN;
      } else {
        throw new Error('CircuitBreaker: Circuit is OPEN, failing fast.');
      }
    }

    try {
      await this.inner.export(spans);
      this.onSuccess();
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }

  private onSuccess() {
    this.failureCount = 0;
    this.state = CircuitState.CLOSED;
  }

  private onFailure() {
    this.failureCount++;
    this.lastFailureTime = Date.now();
    if (this.failureCount >= this.config.threshold) {
      this.state = CircuitState.OPEN;
    }
  }

  async shutdown(): Promise<void> {
    await this.inner.shutdown?.();
  }
}

export class RetryingTraceExporter implements TraceExporter {
  constructor(
    private readonly inner: TraceExporter,
    private readonly config: {
      maxRetries?: number;
      initialDelayMs?: number;
      maxDelayMs?: number;
    },
  ) {}
  async export(spans: TraceSnapshot[]): Promise<void> {
    const maxRetries = this.config.maxRetries ?? 3;
    const initialDelay = this.config.initialDelayMs ?? 100;
    const maxDelay = this.config.maxDelayMs ?? 2000;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        return await this.inner.export(spans);
      } catch (error) {
        if (attempt === maxRetries) throw error;

        // Take the minimum between the current delay and the maximum delay
        const backoff = Math.min(maxDelay, initialDelay * Math.pow(2, attempt));
        const jitter = Math.random() * 0.2 * backoff;
        const delay = backoff + jitter;

        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
  }
  async shutdown?(): Promise<void> {
    await this.inner.shutdown?.();
  }
}

export class FileTraceExporter implements TraceExporter {
  constructor(private readonly filePath: string) {}

  async export(spans: TraceSnapshot[]): Promise<void> {
    try {
      const payload =
        spans.map((span) => JSON.stringify(span)).join('\n') + '\n';

      await appendFile(this.filePath, payload);
    } catch (error) {
      console.error(`[Corelens] Write failed:`, error);
      throw error;
    }
  }
}

class OtlpHttpTraceExporter implements TraceExporter {
  private readonly transport: OtlpHttpTransport;

  constructor(
    private readonly config: {
      serviceName: string;
      version: string;
      endpoint: string;
      headers?: Record<string, string>;
      timeoutMs?: number;
    },
  ) {
    this.transport = new OtlpHttpTransport({
      endpoint: config.endpoint,
      headers: config.headers,
      timeoutMs: config.timeoutMs,
    });
  }
  async export(spans: TraceSnapshot[]): Promise<void> {
    if (spans.length === 0) return;

    await this.transport.postJson(this.format(spans));
  }
  async shutdown?(): Promise<void> {}

  private format(spans: TraceSnapshot[]): OTLPJSONRequestSchema {
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

  private formatAttributes(attrs: SpanAttribute): OTLPResourceAttribute[] {
    const result: OTLPResourceAttribute[] = [];
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
