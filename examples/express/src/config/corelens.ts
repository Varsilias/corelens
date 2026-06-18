import { PrometheusTextExporter, corelens } from '@varsilias/corelens';
import {
  ExpressMetricsAdapter,
  ExpressTracingAdapter,
} from '@varsilias/corelens/adapter';
import type { Express } from 'express';

export const lens = corelens({
  serviceName: process.env.CORELENS_SERVICE_NAME ?? 'corelens-commerce-example',
  export: {
    enabled: true,
    mode: 'batch',
    destination: {
      type: 'otlp-http',
      endpoint: 'http://localhost:4318',
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
        enabled: true,
        mode: 'simple',
        destination: {
          type: 'otlp-http',
          // filePath: 'app.log',
          endpoint: 'http://localhost:4318/v1/logs',
        },
        // destination: {
        //   type: 'otlp-http',
        //   endpoint: `https://o${process.env.SENTRY_ORG_ID}.ingest.de.sentry.io/api/${process.env.SENTRY_PROJECT_ID}/integration/otlp/v1/logs`,
        //   headers: {
        //     'x-sentry-auth': `sentry sentry_key=${process.env.SENTRY_KEY}`,
        //   },
        // },
      },
      metrics: {
        enabled: false,
        // destination: {
        //   type: 'file',
        //   filePath: 'metrics.prom',
        // },
        // batch: {
        //   scheduledDelayMs: 15_000, // every 15 sconds
        // },
      },
      traces: {
        enabled: true,
        // destination: {
        //   type: 'file',
        //   filePath: 'traces.log',
        // },
        destination: {
          type: 'otlp-http',
          endpoint: `https://o${process.env.SENTRY_ORG_ID}.ingest.de.sentry.io/api/${process.env.SENTRY_PROJECT_ID}/integration/otlp/v1/traces`,
          headers: {
            'x-sentry-auth': `sentry sentry_key=${process.env.SENTRY_KEY}`,
          },
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
