import { appendFile, FileHandle } from 'node:fs/promises';
import { Exporter } from './types';
import { PathLike } from 'node:fs';
import { SignalFormatter } from '../core';

export class FileExporter<
  T extends Record<string, any>,
> implements Exporter<T> {
  constructor(
    private readonly filePath: string | PathLike | FileHandle,
    private readonly formatter: SignalFormatter<T, string>,
  ) {}

  async export(records: T[]): Promise<void> {
    try {
      const payload =
        records.map((record) => this.formatter.format(record)).join('\n') +
        '\n';

      await appendFile(this.filePath, payload);
    } catch (error) {
      console.error(`[Corelens] Write failed:`, error);
      throw error;
    }
  }
}
