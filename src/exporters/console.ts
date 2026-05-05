import { once } from 'node:events';
import { Exporter } from './types';
import { ExportSignal, SignalFormatter } from '../core';

export class ConsoleExporter<T> implements Exporter<T> {
  constructor(
    // If maxRecordsPerExport is "0", it means do not batch
    // Use "zero" for when user wants to write logs to the console
    // for other kinds of record(traces & metrics), respect the set value
    // if user mistakenly set it to zero for non-log values, we use 50 to prevent noise
    private readonly signalType: ExportSignal = 'logs',
    private readonly formatter: SignalFormatter<T, string>,
    private shouldSkipRecords: boolean = false,
    private maxRecordsPerExport = 50,
  ) {
    if (this.signalType === 'logs') {
      this.maxRecordsPerExport = 0;
      this.shouldSkipRecords = false;
    }
  }

  async export(records: T[]): Promise<void> {
    if (!this.shouldSkipRecords && this.signalType === 'logs') {
      return this.exportLogs(records);
    }
    const batch = records.slice(-this.maxRecordsPerExport);

    for (const record of batch) {
      const line = this.formatter.format(record) + '\n';
      const canContinue = process.stdout.write(line);
      if (!canContinue) {
        await once(process.stdout, 'drain');
      }
    }

    if (this.shouldSkipRecords) {
      const skipped = records.length - batch.length;
      if (skipped > 0) {
        const canContinue = process.stderr.write(
          `[Corelens] ConsoleExporter skipped ${skipped} ${this.signalType}\n`,
        );

        if (!canContinue) {
          await once(process.stderr, 'drain');
        }
      }
    }
  }

  async shutdown(): Promise<void> {}

  private async exportLogs(records: T[]) {
    for (const record of records) {
      const line = this.formatter.format(record) + '\n';
      const canContinue = process.stdout.write(line);
      if (!canContinue) {
        await once(process.stdout, 'drain');
      }
    }
  }
}
