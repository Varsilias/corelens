export interface Exporter<T> {
  export(records: T[], signal?: AbortSignal): Promise<void>;
  shutdown?(): Promise<void>;
}
