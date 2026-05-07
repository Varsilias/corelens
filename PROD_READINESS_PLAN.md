# Corelens Production Readiness Plan

Use the checklist as small gates, but execute them in dependency order instead of document order.

## Rule For Every Item

For each checklist point, mark exactly one status:

- `Verified by test`
- `Verified manually`
- `Implemented + tested`
- `Deferred with reason`
- `Not applicable`

Update `PROD_READINESS_STATUS.md` after each small batch.

## Phase 0: Baseline

Goal: know current state before changing more code.

1. Run `npm run build`.
2. Run `npm test -- --runInBand`.
3. Run `npm pack --dry-run`.
4. Record current failures and gaps.
5. Do not fix anything except build blockers.

Covers packaging sanity, type declarations, and current test baseline.

## Phase 1: Config + API Contract

Start here because many later tests need reliable config.

Implement/check:

- logs, metrics, and traces enable independently
- export enable independently
- invalid config fails fast
- missing required export config behavior
- sampling validation
- signal-level overrides
- defaults are intentional

Add focused tests:

- `tests/config/normalisation.spec.ts`
- `tests/config/validation.spec.ts`
- `tests/config/signal-overrides.spec.ts`

Outcome: config behavior is locked and later tests can use config helpers confidently.

## Phase 2: Exporter Unit Tests

Do exporters before framework work.

Implement/check:

- console exporter drain awareness
- file exporter success/failure/shutdown
- OTLP exporter timeout and non-2xx handling
- retry backoff behavior
- circuit breaker closed/open/half-open/recover
- export errors counted
- last export error exposed

Add focused tests:

- `tests/exporters-console.spec.ts`
- `tests/exporters-file.spec.ts`
- `tests/exporters-otlp-http.spec.ts`
- `tests/exporters-retry.spec.ts`
- `tests/exporters-circuit-breaker.spec.ts`

Use fake exporters and fake timers where possible. Avoid real network except in the later OTLP integration phase.

## Phase 3: Queues + Shutdown

This is the main production safety gate.

Implement/check:

- batch queue bounded
- `drop-newest`
- `drop-oldest`
- remove records only after successful export
- failed exports retained until pressure
- shutdown idempotent
- timers cleared
- timers use `unref()`
- flush timeout protection
- no unhandled rejections
- no open handles after shutdown

Add focused tests:

- `tests/log-pipeline.spec.ts`
- `tests/tee-pipeline.spec.ts`
- `tests/batch-span-processor.spec.ts`
- `tests/metrics-scheduler.spec.ts`
- `tests/shutdown.spec.ts`

Keep process-signal tests separate and minimal, likely using a child process.

## Phase 4: Tracing Correctness

Lock the trace model.

Implement/check:

- unsampled traces propagate context but are not exported
- inbound W3C `traceparent` continues trace
- outbound `traceparent` uses client span ID
- span kind mapping
- span status mapping
- timestamps are Unix nanoseconds
- attributes preserve primitive types

Add focused tests:

- `tests/tracing-sampling.spec.ts`
- `tests/w3c-propagation.spec.ts`
- `tests/span-lifecycle.spec.ts`
- `tests/otlp-trace-format.spec.ts`

## Phase 5: Metrics Correctness + Memory Safety

Implement/check:

- metrics cardinality bounded
- high-cardinality labels guarded
- Prometheus escaping
- metrics hot path avoids repeated work where practical
- runtime collector does not leak intervals
- debug stats do not return massive payloads

Add focused tests:

- `tests/metrics-registry.spec.ts`
- `tests/runtime-collector.spec.ts`
- `tests/prometheus-format.spec.ts`

## Phase 6: Logging Correctness

Implement/check:

- logs enriched only when context exists
- no `undefined` trace fields leak
- hot-path logging avoids unnecessary deep copies/stringify
- logs queue bounded
- dropped counts exposed

Add focused tests:

- `tests/logger.spec.ts`
- `tests/log-formatters.spec.ts`
- `tests/log-enrichment.spec.ts`

## Phase 7: Framework Adapter Integration

Do this after core logs, metrics, and traces are stable.

Implement/check per framework:

- metrics adapter works
- tracing adapter works
- route handler log enrichment works
- response status captured
- error responses mark spans error
- ignored routes skipped
- unmatched routes safe
- no Express `next()` or Fastify `done()` stalls

Add focused tests:

- `tests/integration-express.spec.ts`
- `tests/integration-fastify.spec.ts`
- `tests/integration-hono.spec.ts`

Keep each test app tiny.

## Phase 8: OTLP Collector Compatibility

This is a manual or integration gate, not a unit-test gate.

Implement/check:

- traces accepted by Collector
- metrics accepted by Collector
- logs accepted by Collector
- custom headers work
- timeout aborts correctly

Add either:

- `docker-compose.otel-test.yml`
- `tests/integration-otlp-collector.spec.ts`

If CI cannot run Docker, document this as a manual release gate.

## Phase 9: Corelens Self-Observability

Implement/check:

- `lens.getStats()` exposes logs, metrics, and traces
- export stats exposed
- dropped counts exposed
- retry/failure counts exposed
- queue length exposed
- shutdown flush result observable
- warnings controlled by config

Add focused tests:

- `tests/stats.spec.ts`
- `tests/diagnostics.spec.ts`

This phase may require small API additions if shutdown result is not currently observable.

## Phase 10: Performance + Load

Measure first, optimize second.

Create scripts:

- `bench/logger.js`
- `bench/metrics.js`
- `bench/traces.js`
- `bench/express-enabled-disabled.js`
- `bench/fastify-enabled-disabled.js`
- `bench/hono-enabled-disabled.js`
- `bench/exporter-failure.js`

Check:

- logging throughput
- metrics hot-path throughput
- trace span creation
- framework overhead enabled vs disabled
- exporter failure under load
- memory remains bounded

Use simple pass/fail thresholds only after the first baseline.

## Phase 11: Packaging + Docs

Do this near the end so docs reflect final API.

Implement/check:

- package exports
- CJS behavior
- type declarations
- peer dependencies
- optional framework dependencies
- `files` field
- README
- LICENSE
- CHANGELOG
- examples setup

Commands:

```bash
npm run build
npm pack --dry-run
node -e "const c = require('./dist/src'); console.log(Object.keys(c))"
```

Docs to update:

- `README.md`
- `CHANGELOG.md`
- `examples/express/README.md`
- `examples/fastify/README.md`
- `examples/hono/README.md`

## Phase 12: Release Gate

Final pass only after all earlier phases.

Release gate checks:

- no critical audit findings remain
- clean shutdown under load
- OTLP works against local Collector
- memory bounded under exporter failure
- Express, Fastify, and Hono examples work
- public API stable
- README copy-paste setup works

Suggested final command set:

```bash
npm run build
npm test -- --runInBand
npm pack --dry-run
```

Then manually run:

- Express example
- Fastify example
- Hono example
- local OTLP Collector test
- load test with exporter down

## Recommended Increment Order

1. Config tests
2. Exporter tests
3. Queue/shutdown tests
4. Tracing tests
5. Metrics tests
6. Logging tests
7. Framework integrations
8. OTLP Collector
9. Stats/diagnostics
10. Benchmarks
11. Docs/package
12. Final release gate

## Working Pattern

For each phase:

1. Pick 3-5 checklist items only.
2. Write tests first if behavior already exists.
3. Fix only failures from those tests.
4. Update `PROD_READINESS_STATUS.md`.
5. Run `npm run build && npm test -- --runInBand`.
6. Move on.
