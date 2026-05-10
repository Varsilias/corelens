# Corelens

[![status](https://github.com/Varsilias/corelens/actions/workflows/ci.yml/badge.svg)](https://github.com/Varsilias/corelens/actions/workflows/ci.yml)

Corelens is an opinionated, high-performance observability SDK for Node.js application that provides logs, metrics, and traces with minimal setup, built with first class support for OpenTelemetry API specification.

It exists for teams that want useful service telemetry without wiring every observability concern by hand on day one. Corelens is not a full OpenTelemetry replacement. It is a practical SDK that covers common application instrumentation paths and can export to places that already speak OTLP.

## What It Solves

- Structured logs with optional trace correlation.
- Application metrics with counters, gauges, and histograms.
- HTTP request metrics and tracing for supported frameworks.
- Runtime metrics for Node.js process health.
- Local Prometheus text rendering for scrape-based metrics.
- Console, file, and OTLP-HTTP export for logs, metrics, and traces.
- Bounded queues, retry, circuit breaker, and shutdown behavior for production export paths.
- A small debug/stats surface for understanding dropped items, exporter failures, and queue state.

## Install

```sh
npm install @varsilias/corelens
```

Install your framework only if you use its adapter:

```sh
npm install express
npm install fastify
npm install hono
```

Express, Fastify, and Hono are optional peer dependencies. Corelens itself can be used without any framework adapter.

## Quickstart

```ts
import { corelens } from '@varsilias/corelens';

const lens = corelens({
  serviceName: 'checkout-api',
  logs: {
    enabled: true,
    enrichWithTraceContext: true,
  },
  metrics: {
    enabled: true,
  },
  traces: {
    enabled: true,
    samplingRate: 0.25,
  },
  export: {
    enabled: false,
  },
});

lens.logger.info('service started', { port: 3000 });

const requestsTotal = lens.metrics.counter(
  'checkout_requests_total',
  'Total checkout requests',
);

requestsTotal.inc({ route: '/checkout', method: 'POST' });

await lens.tracer.withSpan('checkout.create', async (span) => {
  span?.setAttribute('checkout.flow', 'standard');
});

process.on('SIGTERM', async () => {
  await lens.shutdown();
  process.exit(0);
});
```

## Supported Signals

### Logs

Corelens logs are structured events written through `lens.logger`.

```ts
lens.logger.info('payment accepted', {
  orderId: 'ord_123',
  amount: 42_00,
});

lens.logger.warn('inventory low', { sku: 'sku_123' });
lens.logger.error('payment failed', { orderId: 'ord_123', reason: 'timeout' });
```

Log configuration:

```ts
const lens = corelens({
  serviceName: 'orders-api',
  logs: {
    enabled: true,
    level: 'info',
    format: 'json',
    timestamp: { format: 'iso' },
    maxQueueBytes: 1024 * 1024,
    fullQueuePolicy: 'drop-oldest',
    enrichWithTraceContext: true,
  },
});
```

### Metrics

Metrics are recorded in a local registry and can be rendered as Prometheus text or exported through the export pipeline.

```ts
const ordersTotal = lens.metrics.counter(
  'orders_total',
  'Total orders created',
);

const orderValue = lens.metrics.histogram(
  'order_value',
  'Order value in major currency units',
  { buckets: [10, 25, 50, 100, 250, 500] },
);

ordersTotal.inc({ status: 'created' });
orderValue.observe(42, { currency: 'USD' });
```

Enable HTTP and runtime metrics:

```ts
const lens = corelens({
  serviceName: 'orders-api',
  metrics: {
    enabled: true,
    runtime: {
      enabled: true,
      intervalMs: 5000,
    },
    http: {
      enabled: true,
      ignoredRoutes: ['/metrics', '/health'],
      buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1],
    },
    maxSeriesPerMetric: 1000,
  },
});
```

### Traces

Corelens includes server spans through framework adapters and manual spans for application work.

```ts
await lens.tracer.withSpan('orders.reserveInventory', async (span) => {
  span?.setAttribute('component', 'inventory');
  span?.addEvent('inventory.reserve.started');
});
```

Sampling is configured per service:

```ts
const lens = corelens({
  serviceName: 'orders-api',
  traces: {
    enabled: true,
    samplingRate: 0.1,
    http: {
      enabled: true,
      ignoredRoutes: ['/health'],
    },
  },
});
```

`samplingRate` must be between `0` and `1`.

## Framework Adapters

Corelens currently ships adapters for:

- Express
- Fastify
- Hono

Adapters are explicit. Register them where you set up the app.

### Express

```ts
import express from 'express';
import { corelens, PrometheusTextExporter } from '@varsilias/corelens';
import {
  ExpressMetricsAdapter,
  ExpressTracingAdapter,
} from '@varsilias/corelens/adapter';

const app = express();
const lens = corelens({
  serviceName: 'express-api',
  logs: { enabled: true },
  metrics: { enabled: true, http: { enabled: true } },
  traces: { enabled: true, samplingRate: 1, http: { enabled: true } },
});

new ExpressMetricsAdapter().register(app, lens.httpMetricsRecorder);
new ExpressTracingAdapter().register(app, lens.httpTracingRecorder);

const prometheus = new PrometheusTextExporter();

app.get('/metrics', (_req, res) => {
  res.type('text/plain').send(prometheus.render(lens.metrics.snapshot()));
});

app.get('/debug/stats', (_req, res) => {
  res.json(lens.getStats());
});
```

### Fastify

```ts
import Fastify from 'fastify';
import { corelens } from '@varsilias/corelens';
import {
  FastifyMetricsAdapter,
  FastifyTracingAdapter,
} from '@varsilias/corelens/adapter';

const app = Fastify();
const lens = corelens({
  serviceName: 'fastify-api',
  logs: { enabled: true },
  metrics: { enabled: true, http: { enabled: true } },
  traces: { enabled: true, samplingRate: 1, http: { enabled: true } },
});

new FastifyMetricsAdapter().register(app, lens.httpMetricsRecorder);
new FastifyTracingAdapter().register(app, lens.httpTracingRecorder);
```

### Hono

```ts
import { Hono } from 'hono';
import { corelens } from '@varsilias/corelens';
import {
  HonoMetricsAdapter,
  HonoTracingAdapter,
} from '@varsilias/corelens/adapter';

const app = new Hono();
const lens = corelens({
  serviceName: 'hono-api',
  logs: { enabled: true },
  metrics: { enabled: true, http: { enabled: true } },
  traces: { enabled: true, samplingRate: 1, http: { enabled: true } },
});

new HonoMetricsAdapter().register(app, lens.httpMetricsRecorder);
new HonoTracingAdapter().register(app, lens.httpTracingRecorder);
```

## Export Destinations

Corelens can export to:

- `console`
- `file`
- `otlp-http`

The top-level `export` block is optional. If you provide it, `enabled` must be explicit. Signal overrides under `export.signals` also require their own `enabled` flag.

### Console Export

```ts
const lens = corelens({
  serviceName: 'orders-api',
  logs: { enabled: true },
  export: {
    enabled: true,
    mode: 'simple',
    destination: {
      type: 'console',
      pretty: false,
    },
  },
});
```

### File Export

```ts
const lens = corelens({
  serviceName: 'orders-api',
  logs: { enabled: true },
  metrics: { enabled: true },
  traces: { enabled: true, samplingRate: 1 },
  export: {
    enabled: true,
    mode: 'batch',
    destination: {
      type: 'file',
      filePath: './observability.jsonl',
    },
  },
});
```

### OTLP-HTTP Export

Use the collector base URL. Corelens resolves signal endpoints to `/v1/logs`, `/v1/metrics`, and `/v1/traces`.

```ts
const lens = corelens({
  serviceName: 'orders-api',
  logs: { enabled: true },
  metrics: { enabled: true },
  traces: { enabled: true, samplingRate: 0.5 },
  export: {
    enabled: true,
    mode: 'batch',
    destination: {
      type: 'otlp-http',
      endpoint: 'http://localhost:4318',
      headers: {
        authorization: `Bearer ${process.env.OTLP_TOKEN}`,
      },
      timeoutMs: 5000,
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
      maxQueueSize: 2048,
      maxExportBatchSize: 512,
      scheduledDelayMs: 2000,
      shutdownTimeoutMs: 5000,
      fullQueuePolicy: 'drop-newest',
    },
  },
});
```

### Per-Signal Export Destinations

```ts
const lens = corelens({
  serviceName: 'orders-api',
  logs: { enabled: true },
  metrics: { enabled: true },
  traces: { enabled: true, samplingRate: 1 },
  export: {
    enabled: true,
    mode: 'batch',
    destination: {
      type: 'otlp-http',
      endpoint: 'http://localhost:4318',
    },
    signals: {
      logs: {
        enabled: true,
        destination: {
          type: 'file',
          filePath: './logs.jsonl',
        },
      },
      metrics: {
        enabled: true,
        batch: {
          scheduledDelayMs: 15000,
        },
      },
      traces: {
        enabled: true,
        destination: {
          type: 'otlp-http',
          endpoint: 'http://localhost:4318',
          headers: {
            'x-signal': 'traces',
          },
        },
      },
    },
  },
});
```

## Common Config Recipes

### Basic Logging

```ts
const lens = corelens({
  serviceName: 'worker',
  logs: {
    enabled: true,
    level: 'info',
    format: 'json',
  },
  export: {
    enabled: false,
  },
});
```

### Logs + Metrics

```ts
const lens = corelens({
  serviceName: 'api',
  logs: {
    enabled: true,
    enrichWithTraceContext: true,
  },
  metrics: {
    enabled: true,
    runtime: { enabled: true, intervalMs: 5000 },
    http: { enabled: true, ignoredRoutes: ['/metrics', '/health'] },
  },
});
```

### Logs + Metrics + Traces

```ts
const lens = corelens({
  serviceName: 'api',
  logs: { enabled: true, enrichWithTraceContext: true },
  metrics: { enabled: true, http: { enabled: true } },
  traces: {
    enabled: true,
    samplingRate: 0.25,
    http: { enabled: true },
  },
});
```

### Outbound Client Spans

`withClientSpan` creates a client span and returns a W3C `traceparent` header you can forward to the downstream service.

```ts
const response = await lens.tracer.withClientSpan(
  {
    name: 'GET catalog',
    attributes: {
      'http.method': 'GET',
      'http.url': 'https://catalog.internal/recommendations',
    },
  },
  async ({ traceparent, span }) => {
    const response = await fetch('https://catalog.internal/recommendations', {
      headers: { traceparent },
    });

    span?.setAttribute('http.status_code', response.status);
    return response;
  },
);
```

### Graceful Shutdown

Call `shutdown()` when the process is exiting so batched logs, metrics, and traces can flush.

```ts
let shuttingDown = false;

async function shutdown(signal: NodeJS.Signals) {
  if (shuttingDown) return;
  shuttingDown = true;

  lens.logger.info('shutdown requested', { signal });
  const result = await lens.shutdown();

  if (!result.ok) {
    process.stderr.write(JSON.stringify(result) + '\n');
    process.exit(1);
  }

  process.exit(0);
}

process.once('SIGINT', shutdown);
process.once('SIGTERM', shutdown);
```

Corelens can also register process signal handlers with:

```ts
lifecycle: {
  handleProcessSignals: true;
}
```

Use one approach per app so shutdown ownership stays clear.

## Prometheus Metrics Export

Corelens keeps metrics in process. Expose a Prometheus endpoint by rendering the current snapshot:

```ts
import { PrometheusTextExporter } from '@varsilias/corelens';

const prometheus = new PrometheusTextExporter();

app.get('/metrics', (_req, res) => {
  res.type('text/plain');
  res.send(prometheus.render(lens.metrics.snapshot()));
});
```

For Fastify or Hono, return the rendered text with `content-type: text/plain`.

## Runtime Metrics

Runtime metrics are useful for detecting memory growth, event loop pressure, and process-level health. Enable them under `metrics.runtime`:

```ts
metrics: {
  enabled: true,
  runtime: {
    enabled: true,
    intervalMs: 5000,
  },
}
```

Runtime collection uses an interval. If your app has strict lifecycle requirements, call `lens.shutdown()` during process shutdown.

## Debug and Stats APIs

`lens.getStats()` returns operational state for Corelens itself:

```ts
app.get('/debug/stats', (_req, res) => {
  res.json(lens.getStats());
});
```

Use it to inspect exporter failures, queue length, dropped items, shutdown result, and trace processor state while testing a deployment. Treat this endpoint as internal. Do not expose it publicly without authentication.

## Production Recommendations

- Set a stable `serviceName`.
- Keep `/health`, `/metrics`, and internal debug routes out of HTTP metrics/tracing if they are noisy.
- Use `batch` mode for OTLP export in production.
- Configure retry and circuit breaker for network exporters.
- Keep queues bounded and choose a queue overflow policy intentionally.
- Use sampling for high-traffic trace workloads.
- Call `lens.shutdown()` on process termination.
- Watch `lens.getStats()` during rollout to catch dropped telemetry or exporter failures.
- Prefer sending OTLP to a local or nearby collector instead of directly from every service to a remote vendor.
- Keep sensitive values out of log contexts, span attributes, metric labels, and exporter headers.

## Known Tradeoffs

- Corelens is not a full OpenTelemetry distribution and does not cover every instrumentation package.
- Framework adapters are registered manually. There is no global auto-instrumentation step.
- The npm package is currently CommonJS with type declarations and an exports map. It works from CommonJS and from TypeScript projects using normal interop, but it is not a native dual ESM/CJS package.
- Optional framework dependencies are only needed when you use that framework adapter.
- File export is useful for local development and diagnostics, but production deployments usually want a collector or log shipper.
- Benchmarks in this repo compare specific local scenarios. They should not be read as universal claims about every workload.

## Positioning

### Corelens and OpenTelemetry

OpenTelemetry is the standard ecosystem for telemetry data formats, propagation, and collector pipelines. Corelens uses OTLP-compatible export and W3C trace propagation, but it is intentionally smaller and more opinionated. Use Corelens when you want a direct SDK for application logs, metrics, and traces without building a full OpenTelemetry setup yourself.

If you need broad auto-instrumentation coverage, vendor-specific OpenTelemetry distributions, or deep collector customization, use OpenTelemetry directly alongside or instead of Corelens.

### Corelens, Pino, and Winston

Pino and Winston are mature logging libraries. Corelens is not trying to replace every logging use case they cover. The difference is scope: Corelens provides a logger plus metrics, traces, HTTP adapters, exporters, and shutdown-aware telemetry pipelines in one package.

The repository includes logger benchmarks against Pino and Winston so you can see local results for the Corelens logger API. Treat those numbers as a reproducible comparison for that benchmark script, not as a blanket performance claim.

## Examples

- [Express ecommerce example](examples/express/README.md)
- [Fastify todo example](examples/fastify/README.md)
- [Hono gateway example](examples/hono/README.md)
- [OTLP collector smoke test](tests/integration/otlp-collector/README.md)
- [Benchmarks](bench/README.md)

## Package Imports

```ts
import { corelens, PrometheusTextExporter } from '@varsilias/corelens';
import { ExpressMetricsAdapter } from '@varsilias/corelens/adapter';
import type { CorelensConfig } from '@varsilias/corelens/core';
```

Published entry points:

- `@varsilias/corelens`
- `@varsilias/corelens/adapter`
- `@varsilias/corelens/core`
- `@varsilias/corelens/exporters`
- `@varsilias/corelens/modules`

## License and Attribution

Corelens is open source under the MIT License.

The license allows users to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the software, subject to the license terms. The copyright notice and permission notice must be preserved in copies or substantial portions of the software.

Attribution is required by preserving the MIT license notice. Public acknowledgement or a link back to the Corelens project is appreciated when the project is forked, copied, redistributed, or used as the basis for another project.

Forks and redistributed versions should not imply official endorsement by the Corelens maintainer unless that endorsement has been approved.
