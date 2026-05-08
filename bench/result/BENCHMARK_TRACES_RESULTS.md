# Corelens Tracing Benchmark

Local tracing hot-path benchmark for span creation, closure helpers, and outbound traceparent generation.

## Run Metadata

- Generated: 2026-05-08T00:35:30.466Z
- Node.js: v22.22.0
- Platform: darwin 25.2.0 arm64
- CPU: Apple M4
- Logical cores: 10
- Iterations per benchmark: 100

## Results

| Benchmark | Status | Iterations | ops/sec | avg us/op | p95 us | p99 us | heap delta | Notes |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- |
Trace startSpan + end | ok | 100 | 242,375 | 4.13 | 5.33 | 11.04 | 297 KiB | 
Trace withSpan sync closure | ok | 100 | 137,947 | 7.25 | 19.83 | 31.62 | 369 KiB | 
Trace client span traceparent injection | ok | 100 | 91,303 | 10.95 | 19.58 | 56.37 | -244 KiB | 


## Reading These Numbers

- Higher `ops/sec` is better.
- Lower `avg`, `p95`, and `p99` microseconds per operation are better.
- These are local process benchmarks, not a replacement for load tests in a real service.
