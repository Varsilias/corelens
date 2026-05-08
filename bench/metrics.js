#!/usr/bin/env node
const { measure, resultPath, writeReport } = require('./lib/runner');
const { MetricsRegistry } = require('../dist/src/core/metrics/registry');

const ITERATIONS = Number(process.env.BENCH_ITERATIONS ?? 250_000);

async function main() {
  const registry = new MetricsRegistry({ maxSeriesPerMetric: 10_000 });
  const counter = registry.counter(
    'bench_requests_total',
    'Benchmark requests',
  );
  const gauge = registry.gauge('bench_queue_depth', 'Benchmark queue depth');
  const histogram = registry.histogram(
    'bench_request_duration_seconds',
    'Benchmark duration',
    { buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1] },
  );
  const boundCounter = counter.labels({ route: '/users/:id', status: '200' });
  const boundGauge = gauge.labels({ queue: 'default' });
  const boundHistogram = histogram.labels({ route: '/users/:id' });

  const rows = [
    await measure(
      'Metrics counter inc with bound labels',
      () => {
        boundCounter.inc(1);
      },
      { iterations: ITERATIONS },
    ),
    await measure(
      'Metrics gauge set with bound labels',
      (i) => {
        boundGauge.set(i % 100);
      },
      { iterations: ITERATIONS },
    ),
    await measure(
      'Metrics histogram observe with bound labels',
      (i) => {
        boundHistogram.observe((i % 100) / 1000);
      },
      { iterations: ITERATIONS },
    ),
    await measure(
      'Metrics snapshot render shape',
      () => {
        registry.snapshot();
      },
      { iterations: Math.max(1_000, Math.floor(ITERATIONS / 100)) },
    ),
  ];

  const report = writeReport({
    title: 'Corelens Metrics Benchmark',
    outputFile: resultPath('BENCHMARK_METRICS_RESULTS.md'),
    description:
      'Local hot-path metrics benchmark for counters, gauges, histograms, and snapshot generation.',
    rows,
    metadata: [`Base iterations: ${ITERATIONS.toLocaleString()}`],
  });

  process.stdout.write(report);
}

main().catch((error) => {
  process.stderr.write(
    `${error instanceof Error ? error.stack : String(error)}\n`,
  );
  process.exitCode = 1;
});
