## Corelens Express Ecommerce Example

This example is a small ecommerce API used to exercise Corelens tracing across
HTTP middleware, controllers, services, Prisma/Postgres calls, and Redis calls.
It is the largest example in the repository and is intended to look like a
real service instead of a minimal demo.

Corelens is still installed from the local library source:

```json
"@varsilias/corelens": "file:../../"
```

The TypeScript path alias also points at `../../src/index.ts`, so changes in the
library source are visible while running `npm run dev`.

### Run

```bash
cp .env.example .env
docker compose up -d
npm install
npm run prisma:generate
npm run db:migrate
npm run dev
```

The server listens on `localhost:3000` by default.

### What It Demonstrates

- Express HTTP metrics and tracing adapters.
- Structured request and application logs.
- Trace-enriched logs inside request handlers.
- Custom ecommerce metrics.
- Prometheus rendering at `/metrics`.
- Corelens self-observability at `/debug/stats`.
- OTLP-HTTP export configuration for logs, metrics, and traces.
- Batched export with retry, circuit breaker, queue bounds, and shutdown hooks.

### API

```bash
curl http://localhost:3000/health
curl http://localhost:3000/api/products
curl -X POST http://localhost:3000/api/products \
  -H 'content-type: application/json' \
  -d '{"sku":"SKU-001","name":"Corelens Hoodie","priceCents":6500,"inventory":10}'
curl http://localhost:3000/api/products/:id
curl -X POST http://localhost:3000/api/orders \
  -H 'content-type: application/json' \
  -d '{"customerEmail":"buyer@example.com","items":[{"productId":"PRODUCT_ID","quantity":1}]}'
curl http://localhost:3000/api/orders/:id
curl http://localhost:3000/metrics
curl http://localhost:3000/debug/stats
```

`/metrics` returns Prometheus text from the Corelens metrics snapshot.
`/debug/stats` returns `lens.getStats()` and is meant for local or internal
debugging only.

### Corelens Setup

Corelens setup lives in `src/config/corelens.ts`.

The example enables all three signals:

- Logs with trace correlation and a bounded queue.
- Metrics with HTTP request recording and `/metrics` and `/health` ignored.
- Traces with HTTP request spans and `/debug/stats` ignored.

The Express adapters are registered explicitly:

```ts
new ExpressMetricsAdapter().register(app, lens.httpMetricsRecorder);
new ExpressTracingAdapter().register(app, lens.httpTracingRecorder);
```

Export is configured for OTLP-HTTP at `http://localhost:4318`. The top-level
destination is inherited by logs, metrics, and traces. The commented
`export.signals` destinations show how to override one signal without changing
the others.

If you do not have a collector running, the app still runs, but exporter
failures will show up in `/debug/stats` and diagnostic warnings when enabled.

### Benchmarks

These scripts avoid Postman/manual clients and generate request bodies safely for
write-heavy tests.

```bash
npm run seed:products
npm run bench:products
npm run bench:product-writes
npm run bench:orders
npm run bench:mixed
npm run bench:logger
```

Common knobs:

```bash
BENCH_BASE_URL=http://localhost:3000
BENCH_CONNECTIONS=200
BENCH_DURATION_SECONDS=60
BENCH_RATE=500
BENCH_PRODUCT_COUNT=100
BENCH_ORDER_PRODUCT_POOL=50
BENCH_LOGGER_MESSAGES=500000
```

`bench:products` uses autocannon against `GET /api/products`. The write and
mixed benchmarks use generated JSON payloads so unique product SKUs and customer
emails do not collide under load. `bench:logger` runs Corelens directly and emits
logs inside a traced span to measure logger queue and flush behavior under load.

### Flow

- `src/config/corelens.ts` owns Corelens setup, adapters, metrics rendering, and shared logger/tracer exports.
- `src/routes` maps ecommerce endpoints to controllers.
- `src/controllers` handles HTTP request/response boundaries.
- `src/services` contains application behavior and Redis cache access.
- `src/models` contains Prisma-backed data access.
- `src/middleware` contains Redis-backed rate limiting and session tracking.
- `prisma/schema.prisma` defines the Postgres data model.
