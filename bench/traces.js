#!/usr/bin/env node
const { measure, resultPath, writeReport } = require('./lib/runner');
const {
  TraceContextStore,
  TraceIdGenerator,
  Tracer,
} = require('../dist/src/core/traces');
const { SimpleSpanProcessor } = require('../dist/src/core/traces/processor');

const ITERATIONS = Number(process.env.BENCH_ITERATIONS ?? 100_000);

async function main() {
  const processor = new SimpleSpanProcessor(
    { diagnostics: { warnOnExportFailure: false } },
    undefined,
  );
  const tracer = new Tracer(
    new TraceContextStore(),
    new TraceIdGenerator(),
    processor,
    { serviceName: 'bench-traces', samplingRate: 1 },
  );

  const rows = [
    await measure(
      'Trace startSpan + end',
      (i) => {
        const span = tracer.startSpanWithOptions({
          name: 'bench operation',
          attributes: { route: '/users/:id', iteration: i },
        });
        span.end();
      },
      { iterations: ITERATIONS },
    ),
    await measure(
      'Trace withSpan sync closure',
      () => {
        tracer.withSpan('bench closure', () => {});
      },
      { iterations: ITERATIONS },
    ),
    await measure(
      'Trace client span traceparent injection',
      () => {
        tracer.withClientSpan(
          { name: 'GET /downstream', attributes: { method: 'GET' } },
          ({ traceparent }) => {
            if (!traceparent) throw new Error('missing traceparent');
          },
        );
      },
      { iterations: ITERATIONS },
    ),
  ];

  const report = writeReport({
    title: 'Corelens Tracing Benchmark',
    outputFile: resultPath('BENCHMARK_TRACES_RESULTS.md'),
    description:
      'Local tracing hot-path benchmark for span creation, closure helpers, and outbound traceparent generation.',
    rows,
    metadata: [`Iterations per benchmark: ${ITERATIONS.toLocaleString()}`],
  });

  process.stdout.write(report);
}

main().catch((error) => {
  process.stderr.write(
    `${error instanceof Error ? error.stack : String(error)}\n`,
  );
  process.exitCode = 1;
});
