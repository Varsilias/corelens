export interface Exporter<T> {
  export(spans: T[]): Promise<void>;
  shutdown?(): Promise<void>;
}
