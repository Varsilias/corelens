import { PrometheusTextExporter, corelens } from '@varsilias/corelens';
import {
  FastifyMetricsAdapter,
  FastifyTracingAdapter,
} from '@varsilias/corelens/adapter';
import type { FastifyInstance } from 'fastify';

export const lens = corelens({
  serviceName: process.env.CORELENS_SERVICE_NAME ?? 'corelens-fastify-todos',
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
    timestamp: { format: 'iso' },
    format: 'json',
    enrichWithTraceContext: true,
  },
  metrics: {
    enabled: true,
    http: {
      enabled: true,
      ignoredRoutes: ['/metrics', '/health'],
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

export const todoRequestsTotal = metrics.counter(
  'todo_requests_total',
  'Total todo API requests handled by the Fastify example',
);

export const todoMutationsTotal = metrics.counter(
  'todo_mutations_total',
  'Total todo write operations handled by the Fastify example',
);

export const todoOperationDuration = metrics.histogram(
  'todo_operation_duration_seconds',
  'Duration of todo service operations',
  { buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5] },
);

export function registerCorelens(app: FastifyInstance) {
  new FastifyMetricsAdapter().register(app, lens.httpMetricsRecorder);
  new FastifyTracingAdapter().register(app, lens.httpTracingRecorder);
}

export function renderMetrics() {
  return prometheusExporter.render(metrics.snapshot());
}

export function getCorelensStats() {
  return lens.getStats();
}
