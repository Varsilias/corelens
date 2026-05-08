# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project follows semantic versioning after the 1.0.0 release.

## [1.0.0] - Unreleased

### Added

- Logging pipeline with structured JSON output, log levels, queue limits, overflow policy, and optional trace correlation.
- Metrics registry with counters, gauges, histograms, HTTP metrics helpers, series limits, and snapshot rendering.
- Prometheus text exporter for scrape-based metrics endpoints.
- Runtime metrics for Node.js process health.
- Tracing support with server spans, manual spans, sampled traces, span events, span attributes, and span status.
- W3C trace propagation through `traceparent`.
- Outbound/client spans through `tracer.withClientSpan`.
- HTTP framework adapters for Express, Fastify, and Hono.
- Console, file, and OTLP-HTTP exporters.
- Per-signal export overrides for logs, metrics, and traces.
- Retry and circuit breaker support for exporters.
- Bounded export queues and shutdown lifecycle handling.
- Debug/stats APIs for inspecting queue state, dropped telemetry, exporter failures, and shutdown results.
- Example applications for Express, Fastify, and Hono.
- OTLP collector smoke test assets.
- Benchmarks for logger API comparison, metrics, traces, framework adapters, and exporter failure behavior.

### Changed

- Hardened package exports so public entry points are explicit.
- Made framework integrations optional peer dependencies.
- Kept package output CommonJS with generated TypeScript declarations.
- Required explicit `enabled` flags when `export` or `export.signals.*` blocks are provided.

### Fixed

- Shutdown paths flush bounded queues and clear lifecycle resources.
- Export pipeline tests cover retry, circuit breaker, queue overflow, and failed exporter behavior.
- Config validation rejects invalid sampling rates, HTTP histogram buckets, unsupported destinations, and malformed OTLP destinations.
- Coverage command compatibility was restored after dependency override cleanup.

### Documentation

- Added practical setup documentation for logs, metrics, traces, exporters, framework adapters, Prometheus, runtime metrics, stats, and shutdown.
- Added consistent example READMEs for Express, Fastify, and Hono.
- Added benchmark documentation and generated benchmark result output.
- Added OTLP collector smoke test documentation.
- Added production readiness status and release checklist documents.

### Internal

- Split config validation and normalization concerns into smaller config modules.
- Added integration tests across Express, Fastify, Hono, and OTLP collector smoke paths.
- Added production readiness test coverage across configuration, exporters, logs, metrics, traces, lifecycle, and diagnostics.
