import {
  ExpressMetricsAdapter,
  ExpressTracingAdapter,
  PrometheusTextExporter,
  corelens,
} from '@varsilias/corelens';
import type { Express } from 'express';

export const lens = corelens({
  serviceName: process.env.CORELENS_SERVICE_NAME ?? 'corelens-commerce-example',
  export: {
    protocol: 'otlp-http',
    endpoint: 'http://localhost:4318',
    timeoutMs: 3000,

    retry: {
      enabled: true,
      maxRetries: 3,
      initialDelayMs: 100,
      maxDelayMs: 2000,
    },

    circuitBreaker: {
      enabled: true,
      failureThreshold: 5,
      resetTimeoutMs: 30000,
    },
  },
  lifecycle: {
    handleProcessSignals: true,
    warnOnError: true,
  },
  logs: {
    enabled: true,
    maxQueueBytes: 1024 * 1024,
    fullQueuePolicy: 'drop-oldest',
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
    samplingRate: 0.5,
    http: {
      enabled: true,
      ignoredRoutes: ['/debug/stats'],
    },
    batch: {
      maxExportBatchSize: 512,
      maxQueueSize: 2048,
      scheduledDelayMs: 2000,
      fullQueuePolicy: 'drop-newest',
    },
  },
});

export const logger = lens.logger;
export const metrics = lens.metrics;
export const tracer = lens.tracer;

const prometheusExporter = new PrometheusTextExporter();

export const ecommerceRequestsTotal = metrics.counter(
  'ecommerce_requests_total',
  'Total ecommerce API requests handled by the example app',
);

export function registerCorelens(app: Express) {
  new ExpressMetricsAdapter().register(app, lens.httpMetricsRecorder);
  new ExpressTracingAdapter().register(app, lens.httpTracingRecorder);
}

export function renderMetrics() {
  return prometheusExporter.render(metrics.snapshot());
}

export function getCorelensStats() {
  return lens.getStats();
}
