#!/usr/bin/env node
const { measure, resultPath, writeReport } = require('./lib/runner');
const { BatchSpanProcessor } = require('../dist/core/traces/processor');
const { Span, SpanKind } = require('../dist/core/traces/span');

const ITERATIONS = Number(process.env.BENCH_ITERATIONS ?? 20_000);

function endSpan(processor, i) {
  const span = new Span(
    'failed export span',
    'a'.repeat(32),
    i.toString(16).padStart(16, '0').slice(-16),
    null,
    (ended) => processor.onEnd(ended),
    SpanKind.INTERNAL,
  );
  processor.onStart(span);
  span.end();
}

async function main() {
  const exporter = {
    export: async () => {
      throw new Error('collector unavailable');
    },
  };
  const processor = new BatchSpanProcessor(exporter, {
    maxQueueSize: ITERATIONS,
    maxExportBatchSize: ITERATIONS + 1,
    scheduledDelayMs: 60_000,
    shutdownTimeoutMs: 100,
    fullQueuePolicy: 'drop-newest',
    diagnostics: { warnOnExportFailure: false },
  });

  const rows = [
    await measure(
      'Trace enqueue while exporter is unavailable',
      (i) => {
        endSpan(processor, i);
      },
      { iterations: ITERATIONS },
    ),
  ];

  rows.push({
    name: 'Failure mode queue snapshot',
    status: 'ok',
    iterations: processor.snapshot().currentQueueLength,
    durationMs: 0,
    operationsPerSecond: 0,
    averageUs: 0,
    p50Us: 0,
    p95Us: 0,
    p99Us: 0,
    heapDeltaBytes: 0,
    reason: JSON.stringify(processor.snapshot()),
  });

  await processor.shutdown();

  const report = writeReport({
    title: 'Corelens Exporter Failure Benchmark',
    outputFile: resultPath('BENCHMARK_EXPORTER_FAILURE_RESULTS.md'),
    description:
      'Measures hot-path enqueue behavior while an exporter is unavailable. This intentionally avoids flushing during the hot loop.',
    rows,
    metadata: [`Iterations: ${ITERATIONS.toLocaleString()}`],
  });

  process.stdout.write(report);
}

main().catch((error) => {
  process.stderr.write(
    `${error instanceof Error ? error.stack : String(error)}\n`,
  );
  process.exitCode = 1;
});
