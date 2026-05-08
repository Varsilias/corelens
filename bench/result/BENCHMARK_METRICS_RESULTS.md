# Corelens Metrics Benchmark

Local hot-path metrics benchmark for counters, gauges, histograms, and snapshot generation.

## Run Metadata

- Generated: 2026-05-08T00:35:30.459Z
- Node.js: v22.22.0
- Platform: darwin 25.2.0 arm64
- CPU: Apple M4
- Logical cores: 10
- Base iterations: 100

## Results

| Benchmark | Status | Iterations | ops/sec | avg us/op | p95 us | p99 us | heap delta | Notes |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- |
Metrics counter inc with bound labels | ok | 100 | 922,365 | 1.08 | 0.58 | 1.96 | 60 KiB | 
Metrics gauge set with bound labels | ok | 100 | 2,930,403 | 0.34 | 0.21 | 1.25 | 52 KiB | 
Metrics histogram observe with bound labels | ok | 100 | 1,993,342 | 0.50 | 0.50 | 1.46 | 63 KiB | 
Metrics snapshot render shape | ok | 1,000 | 337,121 | 2.97 | 4.79 | 15.75 | 740 KiB | 


## Reading These Numbers

- Higher `ops/sec` is better.
- Lower `avg`, `p95`, and `p99` microseconds per operation are better.
- These are local process benchmarks, not a replacement for load tests in a real service.
