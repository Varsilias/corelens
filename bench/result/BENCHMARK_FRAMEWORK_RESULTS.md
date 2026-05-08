# Corelens Framework Adapter Benchmark

Local request-path benchmark for Express, Fastify, and Hono with Corelens metrics and tracing instrumentation enabled compared to bare request handling.

## Run Metadata

- Generated: 2026-05-08T00:35:30.676Z
- Node.js: v22.22.0
- Platform: darwin 25.2.0 arm64
- CPU: Apple M4
- Logical cores: 10
- Iterations per route: 50

## Results

| Benchmark | Status | Iterations | ops/sec | avg us/op | p95 us | p99 us | heap delta | Notes |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- |
Express instrumentation route | ok | 50 | 90,744 | 11.02 | 56.21 | 154.04 | 305 KiB | 
Express bare route | ok | 50 | 1,062,880 | 0.94 | 1.25 | 1.87 | 71 KiB | 
Fastify instrumentation route | ok | 50 | 8,888 | 112.51 | 272.25 | 1230.29 | -118 KiB | 
Fastify bare route | ok | 50 | 27,888 | 35.86 | 68.75 | 181.08 | 1,423 KiB | 
Hono instrumentation route | ok | 50 | 20,261 | 49.35 | 122.54 | 668.71 | 1,747 KiB | 
Hono bare route | ok | 50 | 71,310 | 14.02 | 20.67 | 32.71 | 695 KiB | 


## Reading These Numbers

- Higher `ops/sec` is better.
- Lower `avg`, `p95`, and `p99` microseconds per operation are better.
- These are local process benchmarks, not a replacement for load tests in a real service.
