import {
  HonoMetricsAdapter,
  HonoTracingAdapter,
  PrometheusTextExporter,
  corelens,
} from '@varsilias/corelens';
import type { Hono } from 'hono';

export const lens = corelens({
  serviceName: process.env.CORELENS_SERVICE_NAME ?? 'corelens-hono-gateway',
  lifecycle: {
    handleProcessSignals: true,
  },
  diagnostics: {
    warnOnConfigFallback: true,
    warnOnExportFailure: true,
  },
  logs: {
    enabled: true,
    maxQueueBytes: 1024 * 1024,
    fullQueuePolicy: 'drop-oldest',
    enrichWithTraceContext: true,
  },
  metrics: {
    enabled: true,
    runtime: {
      enabled: false,
      intervalMs: 2000,
    },
    http: {
      enabled: true,
      ignoredRoutes: ['/metrics', '/health', '/debug/stats'],
    },
  },
  traces: {
    enabled: true,
    samplingRate: 1,
    http: {
      enabled: true,
      ignoredRoutes: ['/debug/stats'],
    },
  },
});

export const logger = lens.logger;
export const metrics = lens.metrics;
export const tracer = lens.tracer;

const prometheusExporter = new PrometheusTextExporter();

export const gatewayRequestsTotal = metrics.counter(
  'gateway_requests_total',
  'Total gateway requests handled by the Hono example',
);

export const upstreamRequestsTotal = metrics.counter(
  'gateway_upstream_requests_total',
  'Total upstream calls made by the Hono example',
);

export const upstreamDuration = metrics.histogram(
  'gateway_upstream_duration_seconds',
  'Duration of upstream calls made by the Hono example',
  { buckets: [0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1] },
);

export function registerCorelens(app: Hono) {
  new HonoMetricsAdapter().register(app, lens.httpMetricsRecorder);
  new HonoTracingAdapter().register(app, lens.httpTracingRecorder);
}

export function renderMetrics() {
  return prometheusExporter.render(metrics.snapshot());
}

export function getCorelensStats() {
  return lens.getStats();
}
