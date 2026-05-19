# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project follows semantic versioning after the 1.0.0 release.

## [1.1.0]

### Added

- NestJS adapter module with `CorelensModule.forRoot()` and factory-based `CorelensModule.forRootAsync()` registration.
- Injectable `CorelensService` for accessing Corelens logger, metrics, tracer, HTTP metrics recorder, and HTTP tracing recorder from Nest providers.
- `CorelensNestLogger` implementation for wiring Corelens into Nest's native logger interface.
- `CorelensHttpInterceptor` for Nest HTTP request metrics and server tracing.
- Dedicated Nest adapter package entry point at `@varsilias/corelens/adapter/nest`.
- NestJS example application with Corelens module registration, logger integration, HTTP interceptor registration, Prometheus metrics endpoint, and debug stats endpoint.

### Changed

- Kept NestJS integration isolated from the shared `@varsilias/corelens/adapter` barrel so non-Nest adapter users do not load Nest runtime dependencies.
- Declared `@nestjs/common` as an optional peer dependency for consumers using the Nest adapter.
- Updated the NestJS example start scripts to build the local Corelens package before starting the app.
- Updated the NestJS example to import Corelens through public package exports instead of local `dist` paths.

### Fixed

- Fixed Nest async module registration so `CorelensService`, `CorelensNestLogger`, and `CorelensHttpInterceptor` are available through Nest dependency injection.
- Fixed Nest route normalization so root and controller-level routes produce `/` and `/metrics`, not double-slash labels such as `//metrics`.
- Fixed the Nest metrics endpoint response handling by using Nest-managed headers instead of taking over the raw Express response.
- Fixed Nest HTTP metrics recording so metrics are still emitted when tracing is disabled or an ignored trace route prevents span creation.
- Fixed Nest span metadata so `http.method` receives the HTTP method only while span naming remains method plus route.

### Internal

- Added focused Nest integration tests for route metadata normalization, parameterized route labels, and metrics behavior when tracing does not create a span.
- Aligned the Nest example dependency ranges with the Nest version used by the root development environment.

## [1.0.0]

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
