import { IMetricsRegistry } from '../core';

export interface HttpMetricsAdapter<TApp> {
  register(app: TApp, recorder: HttpMetricsRecorder): void;
}

class HttpMetricsRecorder {
  constructor(private metrics: IMetricsRegistry) {}

  record(data: {
    method: string;
    route: string;
    status: number;
    durationMs: number;
  }) {
    // record counters/histogram later
  }
}
