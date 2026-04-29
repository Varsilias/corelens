import { Span, TraceSnapshot } from './span';

export class InMemorySpanProcessor {
  private container: TraceSnapshot[] = [];

  onEnd(span: Span) {
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
