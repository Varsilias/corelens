import { Exporter } from './types';

export class NoopExporter<T> implements Exporter<T> {
  async export(records: T[]): Promise<void> {}
  async shutdown(): Promise<void> {}
}
