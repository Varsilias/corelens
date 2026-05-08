# Corelens Benchmarks

These benchmarks give maintainers and users a practical way to see how Corelens behaves on the local machine. They are intentionally simple: build the package, run a focused hot-path loop, and write a markdown report that can be reviewed or committed.

Corelens is more than a logger. It brings logs, metrics, traces, framework adapters, batching, shutdown handling, and export reliability into one SDK. The logger comparison exists because many teams already know Pino and Winston, so it gives a familiar reference point for the Corelens logging API. Pino and Winston are strong logging libraries; the point here is to show that Corelens can stay competitive on the logging path while also carrying the wider observability work.

## Results

Every benchmark writes its latest report to `bench/result`.

The files are overwritten on each run, so the directory always reflects the most recent local benchmark data:

- `bench/result/BENCHMARK_RESULTS.md`
- `bench/result/BENCHMARK_METRICS_RESULTS.md`
- `bench/result/BENCHMARK_TRACES_RESULTS.md`
- `bench/result/BENCHMARK_FRAMEWORK_RESULTS.md`
- `bench/result/BENCHMARK_EXPORTER_FAILURE_RESULTS.md`

## Run Everything

From the repo root:

```sh
npm run bench
```

This builds the project and runs all benchmark groups.

## Run One Benchmark

```sh
npm run bench:logger
npm run bench:metrics
npm run bench:traces
npm run bench:frameworks
npm run bench:exporter-failure
```

## Control Iteration Count

Use `BENCH_ITERATIONS` when you want a faster smoke run or a longer local pass:

```sh
BENCH_ITERATIONS=10000 npm run bench:logger
BENCH_ITERATIONS=5000 npm run bench:frameworks
```

Higher iteration counts usually give steadier numbers, but they also take longer. For comparing changes during development, start small. For release notes or a serious before/after check, run the benchmark a few times on an idle machine and compare the trend, not a single number.

## Reading The Reports

- Higher `ops/sec` is better.
- Lower `avg`, `p95`, and `p99` microseconds per operation are better.
- Heap delta is useful as a smoke signal, but it is not a full memory profile.
- Local benchmarks are not a replacement for load tests in a real service.

The logger report compares only the logging API hot path. It does not include the value Corelens adds through metrics, tracing, HTTP instrumentation, self-observability, batching, retries, or shutdown behavior.
