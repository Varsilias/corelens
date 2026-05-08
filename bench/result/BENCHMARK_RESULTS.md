# Corelens Logger Benchmark

Side-by-side local hot-path comparison of Corelens logger.info against Pino and Winston. This benchmark only compares logging API throughput and does not include Corelens metrics or tracing value.

## Run Metadata

- Generated: 2026-05-08T00:35:30.514Z
- Node.js: v22.22.0
- Platform: darwin 25.2.0 arm64
- CPU: Apple M4
- Logical cores: 10
- Iterations per logger: 100

## Results

| Benchmark | Status | Iterations | ops/sec | avg us/op | p95 us | p99 us | heap delta | Notes |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- |
Corelens logger.info | ok | 100 | 359,442 | 2.78 | 4.96 | 10.29 | 175 KiB | 
Pino logger.info | ok | 100 | 188,309 | 5.31 | 3.37 | 40.83 | -367 KiB | 
Winston logger.info | ok | 100 | 109,961 | 9.09 | 8.08 | 18.00 | -609 KiB | 


## Reading These Numbers

- Higher `ops/sec` is better.
- Lower `avg`, `p95`, and `p99` microseconds per operation are better.
- These are local process benchmarks, not a replacement for load tests in a real service.
- Logger comparisons only compare the logging API hot path. Pino and Winston do not provide Corelens metrics or tracing.
