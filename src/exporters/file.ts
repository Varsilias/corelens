import { Exporter } from './types';
import { createWriteStream, WriteStream } from 'node:fs';
import { SignalFormatter } from '../core';

export class FileExporter<
  T extends Record<string, any>,
> implements Exporter<T> {
  private stream: WriteStream;
  private draining = false;
  private writeQueue: string[] = [];
  constructor(
    private readonly filePath: string,
    private readonly formatter: SignalFormatter<T, string>,
  ) {
    this.stream = createWriteStream(this.filePath, { flags: 'a' });
    this.stream.on('error', (err) => {
      console.error('[Corelens] FileExporter stream error:', err);
    });
  }

  async export(records: T[]): Promise<void> {
    return new Promise((resolve, reject) => {
      const payload =
        records.map((r) => this.formatter.format(r)).join('\n') + '\n';

      if (this.draining) {
        // Stream is under backpressure — queue and wait for drain
        this.writeQueue.push(payload);
        this.stream.once('drain', () => {
          const queued = this.writeQueue.splice(0).join('');
          this.draining = false;
          const ok = this.stream.write(queued);
          if (!ok) this.draining = true;
          resolve();
        });
        return;
      }

      const ok = this.stream.write(payload);
      if (!ok) {
        this.draining = true;
        this.stream.once('drain', () => {
          this.draining = false;
          resolve();
        });
      } else {
        resolve();
      }
    });
  }

  async shutdown(): Promise<void> {
    return new Promise((resolve, reject) => {
      const onError = (error: Error) => {
        this.stream.off('error', onError);
        reject(error);
      };

      this.stream.once('error', onError);
      this.stream.end(() => {
        this.stream.off('error', onError);
        resolve();
      });
    });
  }
}
