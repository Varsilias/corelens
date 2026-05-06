export interface Exporter<T> {
  export(records: T[]): Promise<void>;
  shutdown?(): Promise<void>;
}
