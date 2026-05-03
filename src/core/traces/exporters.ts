import { once } from 'node:events';
import { TraceExporter, TraceSnapshot } from './span';

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
        await once(process.stdout, 'drain');
      }
    }
  }

  async shutdown(): Promise<void> {}
}
