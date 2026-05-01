import { Span, SpanProcessor, TraceSnapshot } from './span';

export class InMemorySpanProcessor implements SpanProcessor {
  private container: TraceSnapshot[] = [];

  onEnd(span: Span) {
    if (!span.sampled) {
      return;
    }
    this.container.push(span.toJSON());
  }

  snapshot(): TraceSnapshot[] {
    return [...this.container];
  }

  clear(): void {
    this.container = [];
  }

  get finishedCount(): number {
    return this.container.length;
  }
}
