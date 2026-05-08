## Corelens Hono Gateway Example

This example is a small gateway-style Hono service. It exposes a product
recommendation endpoint, calls a mock catalog endpoint over HTTP, and uses
`tracer.withClientSpan` to create an outbound client span with a propagated
`traceparent` header.

That makes it useful for seeing both sides of an HTTP flow in one local app:
the incoming Hono request span and the downstream client span Corelens creates
around `fetch`.

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

The server listens on `127.0.0.1:3200` by default. Override it with
`PORT=3201` or `HOST=0.0.0.0`.

By default the gateway calls its own mock catalog route. You can point it at a
different service with `CATALOG_BASE_URL=http://127.0.0.1:4000`.

### API

```bash
curl http://127.0.0.1:3200/health
curl http://127.0.0.1:3200/api/products/CORELENS-TEE/recommendations
curl http://127.0.0.1:3200/mock/catalog/CORELENS-TEE
curl http://127.0.0.1:3200/metrics
curl http://127.0.0.1:3200/debug/stats
```

The recommendation response includes `traceparentReceived: true` when the
outbound client span propagated trace context to the mock catalog endpoint.

### Benchmarks

```bash
npm run bench
```

The benchmark runs `autocannon` against the recommendation endpoint, so it
exercises Hono request instrumentation, custom gateway metrics, request logs,
and the outbound `withClientSpan` fetch path.

### Flow

- `src/config/corelens.ts` owns Corelens setup, Hono adapters, metrics rendering, and shared logger/tracer exports.
- `src/app.ts` builds the Hono app and registers health, metrics, stats, and gateway routes.
- `src/routes/gateway.routes.ts` maps the public gateway route and the local mock catalog route.
- `src/services/catalog-client.ts` wraps `fetch` in `tracer.withClientSpan` and forwards `traceparent`.
- `src/index.ts` bootstraps the server and handles shutdown.

### Check The Example

```bash
npm run typecheck
```
