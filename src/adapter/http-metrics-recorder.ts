import { Counter, Histogram, IMetricsRegistry } from '../core';

export const DEFAULT_HTTP_BUCKETS = [
  0.005, // 5ms
  0.01, // 10ms
  0.025, // 25ms
  0.05, // 50ms
  0.1, // 100ms
  0.25, // 250ms
  0.5, // 500ms
  1, // 1s
  2.5, // 2.5s
  5, // 5s
  10, // 10s
];

type HttpMetricsAdapterOptions = {
  enabled: boolean;
  buckets: number[];
  ignoredRoutes?: string[];
};
export interface HttpMetricsAdapter<TApp> {
  register(app: TApp, recorder: HttpMetricsRecorder): void;
}

export class HttpMetricsRecorder {
  private readonly ignoredRoutes: Set<string>;
  private readonly requestsTotal: Counter;
  private readonly requestDurationSeconds: Histogram;

  constructor(
    private metrics: IMetricsRegistry,
    private readonly config: HttpMetricsAdapterOptions,
  ) {
    this.requestsTotal = this.metrics.counter(
      'http_requests_total',
      'Total number of HTTP requests processed, partitioned by method, route, and status code.',
    );

    this.requestDurationSeconds = this.metrics.histogram(
      'http_request_duration_seconds',
      'Duration of HTTP requests in seconds, partitioned by method, route, and status code.',
      { buckets: config.buckets },
    );
    this.ignoredRoutes = new Set(config.ignoredRoutes);
  }

  get isEnabled(): boolean {
    return this.config.enabled;
  }

  record(data: {
    method: string;
    route: string;
    status: number;
    durationSeconds: number;
  }) {
    if (!this.isEnabled || this.ignoredRoutes.has(data.route)) {
      return;
    }
    const labels = {
      method: data.method,
      route: data.route,
      status: data.status.toString(),
    };

    this.requestsTotal.inc(1, labels);

    this.requestDurationSeconds.observe(data.durationSeconds, labels);
  }
}
