# Corelens Exporter Failure Benchmark

Measures hot-path enqueue behavior while an exporter is unavailable. This intentionally avoids flushing during the hot loop.

## Run Metadata

- Generated: 2026-05-08T00:35:30.471Z
- Node.js: v22.22.0
- Platform: darwin 25.2.0 arm64
- CPU: Apple M4
- Logical cores: 10
- Iterations: 50

## Results

| Benchmark | Status | Iterations | ops/sec | avg us/op | p95 us | p99 us | heap delta | Notes |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- |
Trace enqueue while exporter is unavailable | ok | 50 | 246,407 | 4.06 | 5.58 | 51.08 | 128 KiB | 
Failure mode queue snapshot | ok | 50 | - | - | - | - | 0 KiB | {"startedCount":55,"endedCount":55,"sampledCount":55,"droppedCount":5,"exportedCount":0,"currentQueueLength":50,"maxQueueSize":50,"backPressureHitCount":5,"evictedCount":0,"unsampledCount":0,"flushCount":0,"failedExportCount":0}


## Reading These Numbers

- Higher `ops/sec` is better.
- Lower `avg`, `p95`, and `p99` microseconds per operation are better.
- These are local process benchmarks, not a replacement for load tests in a real service.
