export type SpanStatus = 'unset' | 'ok' | 'error';

type SpanAttribute = Record<string, string>;
type SpanEvent = {
  name: string;
  timestamp: number;
  attributes: Record<string, any>;
};

export type TraceSnapshot = {
  name: string;
  traceId: string;
  spanId: string;
  parentSpanId: string | null;
  startTime: number;
  startTimeEpoch: number;
  endTime: number;
  endTimeEpoch: number;
  durationMs: number;
  status: SpanStatus;
  attributes: {
    [x: string]: string;
  };
  events: SpanEvent[];
};

export interface ISpan {
  getTraceId(): string;
  getParentSpanId(): string | null;
  getSpanId(): string;
  isSampled(): boolean;
  setAttribute(key: string, value: string): void;
  recordException(error: any): void;
  end(): void;
  addEvent(name: string, attributes: Record<string, any>): void;
  toJSON(): TraceSnapshot;
}

export class Span implements ISpan {
  private readonly startTime: number;
  private readonly startTimeEpochNs: number;

  private endTime: number = 0;
  private endTimeEpochNs: number = 0;
  private status: SpanStatus = 'unset';

  private readonly attributes: SpanAttribute = {};
  private readonly events: SpanEvent[] = [];

  constructor(
    public readonly name: string,
    public readonly traceId: string,
    public readonly spanId: string,
    public readonly parentSpanId: string | null,
    private readonly onEnd: (span: Span) => void,
    public readonly sampled: boolean = true,
  ) {
    this.startTime = performance.now();
    this.startTimeEpochNs = Date.now();
  }

  getTraceId(): string {
    return this.traceId;
  }

  getParentSpanId(): string | null {
    return this.parentSpanId;
  }

  getSpanId(): string {
    return this.spanId;
  }

  isSampled(): boolean {
    return this.sampled;
  }

  setAttribute(key: string, value: string) {
    if (this.endTime > 0 || this.endTimeEpochNs > 0) return;

    this.attributes[key] = value;
  }

  setStatus(status: SpanStatus) {
    if (this.endTime > 0 || this.endTimeEpochNs > 0) return;
    this.status = status;
  }

  recordException(error: any) {
    if (this.endTime > 0 || this.endTimeEpochNs > 0) return;
    this.status = 'error';

    const isErrorInstance = error instanceof Error;

    // OpenTelemetry standard keys for exceptions
    const exceptionEvent = {
      'exception.type': isErrorInstance ? error.constructor.name : typeof error,
      'exception.message': isErrorInstance ? error.message : String(error),
      'exception.stacktrace': isErrorInstance ? error.stack : '',
      'exception.escaped': true, // Indicates the error was handled/recorded
    };

    this.addEvent('exception', exceptionEvent);
  }

  end() {
    if (this.endTime > 0 || this.endTimeEpochNs > 0) return;
    this.endTime = performance.now();
    this.endTimeEpochNs = Date.now();

    // Notify the processor that we are done
    this.onEnd(this);
  }

  /**
   * General purpose method to add a point-in-time event
   */
  addEvent(name: string, attributes: Record<string, any> = {}) {
    if (this.endTime > 0 || this.endTimeEpochNs > 0) return;

    this.events.push({
      name,
      timestamp: performance.now(),
      attributes,
    });
  }

  toJSON(): TraceSnapshot {
    return {
      name: this.name,
      traceId: this.traceId,
      spanId: this.spanId,
      parentSpanId: this.parentSpanId,
      startTime: this.startTime,
      endTime: this.endTime,
      durationMs: this.endTime - this.startTime,
      status: this.status,
      attributes: { ...this.attributes },
      events: [...this.events],
      startTimeEpoch: this.startTimeEpochNs,
      endTimeEpoch: this.endTimeEpochNs,
    };
  }
}

export class NoopSpan implements ISpan {
  constructor(public readonly name: string = 'noop') {}

  setAttribute(_key: string, _value: string): void {}

  recordException(_error: any): void {}

  addEvent(_name: string, _attributes?: Record<string, any>): void {}

  end(): void {}

  getTraceId(): string {
    return '';
  }
  getSpanId(): string {
    return '';
  }
  getParentSpanId(): string | null {
    return null;
  }
  isSampled(): boolean {
    return false;
  }

  toJSON(): TraceSnapshot {
    return {
      name: this.name,
      traceId: '',
      spanId: '',
      parentSpanId: '',
      startTime: 0,
      endTime: 0,
      durationMs: 0,
      attributes: {},
      events: [],
      status: 'ok' as SpanStatus,
      endTimeEpoch: 0,
      startTimeEpoch: 0,
    };
  }
}
