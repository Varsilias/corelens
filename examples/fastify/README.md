## Corelens Fastify Todo Example

This example is a small in-memory todo API used to exercise Corelens with
Fastify route hooks, custom application metrics, structured logs, request
tracing, Prometheus rendering, and graceful shutdown.

Corelens is installed from the local library source:

```json
"@varsilias/corelens": "file:../../"
```

The TypeScript path alias also points at `../../src/index.ts`, so library
changes are visible while running `npm run dev`.

### Run

```bash
npm install
npm run dev
```

The server listens on `127.0.0.1:3100` by default. Override it with
`PORT=3101` or `HOST=0.0.0.0`.

### What It Demonstrates

- Fastify HTTP metrics and tracing adapters.
- Structured logs for todo actions.
- Trace-enriched logs inside Fastify route handlers.
- Custom counters and histograms for todo operations.
- Prometheus rendering at `/metrics`.
- Corelens self-observability at `/debug/stats`.
- Graceful shutdown through `lens.shutdown()`.

### API

```bash
curl http://127.0.0.1:3100/health
curl http://127.0.0.1:3100/api/todos
curl -X POST http://127.0.0.1:3100/api/todos \
  -H 'content-type: application/json' \
  -d '{"title":"Review Corelens Fastify telemetry"}'
curl http://127.0.0.1:3100/api/todos/1
curl -X PATCH http://127.0.0.1:3100/api/todos/1/complete
curl -X DELETE http://127.0.0.1:3100/api/todos/1
curl http://127.0.0.1:3100/metrics
curl http://127.0.0.1:3100/debug/stats
```

`/metrics` returns Prometheus text from the Corelens metrics snapshot.
`/debug/stats` returns `lens.getStats()` and is meant for local or internal
debugging only.

### Corelens Setup

Corelens setup lives in `src/config/corelens.ts`.

The example enables logs, metrics, and traces, but it does not enable the
background export pipeline. Metrics are exposed through Prometheus text instead.
That keeps the todo example self-contained while still exercising the Fastify
adapter path.

The Fastify adapters are registered explicitly:

```ts
new FastifyMetricsAdapter().register(app, lens.httpMetricsRecorder);
new FastifyTracingAdapter().register(app, lens.httpTracingRecorder);
```

HTTP metrics ignore `/metrics` and `/health`; HTTP tracing ignores
`/debug/stats` so the diagnostics endpoint does not create noisy trace data.

### Benchmarks

```bash
npm run bench
```

The benchmark runs `autocannon` against `GET /api/todos`, which exercises the
Fastify adapter path, custom todo metrics, trace context, and request logging.

### Flow

- `src/config/corelens.ts` owns Corelens setup, Fastify adapters, metrics rendering, and shared logger/tracer exports.
- `src/app.ts` builds the Fastify app and registers health, metrics, stats, and todo routes.
- `src/routes/todo.routes.ts` maps todo endpoints to service calls.
- `src/services/todo.service.ts` contains the in-memory todo behavior and custom spans/metrics.
- `src/index.ts` bootstraps the server and handles shutdown.

### Check The Example

```bash
npm run typecheck
```
