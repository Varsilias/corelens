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
    enabled: true,
    mode: 'batch',
    destination: {
      type: 'console',
      pretty: false,
    },

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
    batch: {
      maxExportBatchSize: 512,
      maxQueueSize: 2048,
      scheduledDelayMs: 2000,
      fullQueuePolicy: 'drop-newest',
    },
    signals: {
      logs: {
        destination: {
          type: 'console',
          pretty: true,
        },
      },
      metrics: {
        destination: {
          type: 'file',
          filePath: 'metrics.prom',
        },
      },
      traces: {
        destination: {
          type: 'file',
          filePath: 'traces.log',
        },
      },
    },
  },
  diagnostics: {
    warnOnConfigFallback: true,
    warnOnExportFailure: true,
  },
  lifecycle: {
    handleProcessSignals: true,
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
