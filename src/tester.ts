import { CorelensConfig } from './core/config';
import { corelens } from './core/orchestrator';

// const config = {
//   serviceName: 'payment-service',
//   logs: {
//     enabled: true,
//     fullQueuePolicy: 'drop-newest',
//     maxQueueBytes: 4 * 1024 * 1024,
//     reportStatsOnShutdown: true,
//     writer: {
//       highWaterMark: 64 * 1024,
//     },
//   },
//   metrics: {
//     enabled: true,
//     runtime: {
//       enabled: false,
//       intervalMs: 10000,
//     },
//   },
//   traces: {
//     enabled: true,
//   },
//   lifecycle: {
//     handleProcessSignals: true,
//   },
// } as CorelensConfig;

// async function main() {
//   //   const startMemory = process.memoryUsage();
//   //   const start = performance.now();
//   //   const lens = corelens(config);
//   //   const logger = lens.logger;
//   //   for (let i = 0; i < 100_000; i++) {
//   //     logger.info('test', { i });
//   //   }
//   //   const produceEnd = performance.now();
//   //   const flushStart = performance.now();
//   //   await lens.shutdown();
//   //   const flushEnd = performance.now();
//   //   const endMemory = process.memoryUsage();
//   //   const memoryDiff = {
//   //     rss: (endMemory.rss - startMemory.rss) / 1024 / 1024,
//   //     heapUsed: (endMemory.heapUsed - startMemory.heapUsed) / 1024 / 1024,
//   //   };
//   //   console.log({
//   //     produceTimeMs: produceEnd - start,
//   //     flushTimeMs: flushEnd - flushStart,
//   //     totalTimeMs: flushEnd - start,
//   //     memoryDiff,
//   //     stats: lens.getStats(),
//   //   });

//   const startMemory = process.memoryUsage();
//   const start = performance.now();

//   const lens = corelens(config);
//   const metrics = lens.metrics;

//   // const counter = metrics.counter('requests_total');
//   // counter.inc();
//   // counter.inc(5);

//   // const memory = metrics.gauge('memory_usage_bytes');
//   // memory.set(process.memoryUsage().heapUsed);

//   const h = metrics.histogram('test_duration', {
//     buckets: [1, 2, 5],
//   });

//   h.observe(1);
//   h.observe(3);
//   h.observe(6);

//   console.log(JSON.stringify(metrics.snapshot(), null, 2));

//   h.observe(1, { route: '/a' });
//   h.observe(2, { route: '/b' });

//   console.log(JSON.stringify(metrics.snapshot(), null, 2));

//   const end = performance.now();
//   const endMemory = process.memoryUsage();

//   const memoryDiff = {
//     rss: (endMemory.rss - startMemory.rss) / 1024 / 1024,
//     heapUsed: (endMemory.heapUsed - startMemory.heapUsed) / 1024 / 1024,
//   };
//   console.log({
//     totalTimeMs: end - start,
//     memoryDiff,
//     // stats: lens.getStats(),
//   });
// }

// main().catch((err) => {
//   console.error(err);
//   process.exitCode = 1;
// });

// async function stressTestInternal() {
//   const lens = corelens({
//     serviceName: 'stress-test',
//     metrics: { enabled: true },
//   });

//   const iterations = 1_000_000;
//   const h = lens.metrics.histogram(
//     'stress_duration',
//     'Internal stress duration distribution',
//     {
//       buckets: [0.1, 0.5, 1, 2, 5],
//     },
//   );
//   const c = lens.metrics.counter(
//     'stress_counter',
//     'Stress test interation counter',
//   );

//   console.log(
//     `--- Starting Internal Stress: ${iterations.toLocaleString()} iterations ---`,
//   );

//   const startMemory = process.memoryUsage().heapUsed;
//   const startTime = performance.now();

//   // Test 1: Raw Observation (includes label serialization every time)
//   for (let i = 0; i < iterations; i++) {
//     h.observe(Math.random() * 6, { method: 'GET', status: '200' });
//     if (i % (iterations / 4) === 0) c.inc(1);
//   }

//   const midTime = performance.now();
//   const midMemory = process.memoryUsage().heapUsed;

//   // Test 2: Pre-bound Observation (The "Hot Path" optimization)
//   const boundH = h.labels({ method: 'POST', status: '201' });
//   for (let i = 0; i < iterations; i++) {
//     boundH.observe(Math.random() * 6);
//   }

//   const endTime = performance.now();
//   const endMemory = process.memoryUsage().heapUsed;

//   console.log('--- Results ---');
//   console.log(
//     `Raw Path: ${(midTime - startTime).toFixed(2)}ms (${(iterations / (midTime - startTime)).toFixed(2)} ops/ms)`,
//   );
//   console.log(
//     `Bound Path: ${(endTime - midTime).toFixed(2)}ms (${(iterations / (endTime - midTime)).toFixed(2)} ops/ms)`,
//   );
//   console.log(
//     `Memory Delta: ${((endMemory - startMemory) / 1024 / 1024).toFixed(2)}MB`,
//   );

//   // Verify Correctness
//   const snapshot = lens.metrics.snapshot();
//   console.log('--- Correctness Check ---');
//   console.log(
//     JSON.stringify(
//       snapshot.entries.find((e) => e.name === 'stress_duration'),
//       null,
//       2,
//     ),
//   );
// }

// stressTestInternal();

// async function traceTest() {
//   const lens = corelens({
//     serviceName: 'trace-test',
//     logs: { enabled: true, enrichWithTraceContext: true },
//     traces: { enabled: true },
//   });

//   const logger = lens.logger;
//   const tracer = lens.tracer;

//   const iterations = 10;

//   for (let i = 0; i < iterations; i++) {
//     tracer.withSpan('root', () => {
//       logger.info('inside trace', { index: i });
//     });
//   }

//   console.log(lens.getStats());
// }

// traceTest();

// corelens({
//   serviceName: 'repro',
//   lifecycle: { handleProcessSignals: true },
//   logs: { enabled: false },
//   metrics: { enabled: false },
//   traces: { enabled: false },
//   export: {
//     enabled: false,
//     destination: { type: 'console' },
//   },
// });

// setInterval(() => {
//   console.log('still alive');
// }, 1000);

// import { TeePipeline } from './core/logger/tee-pipeline';
// import { NoopPipeline } from './core/logger/pipeline';

// async function main() {
//   const exported: unknown[] = [];

//   const tee = new TeePipeline(
//     new NoopPipeline(),
//     {
//       async export(records) {
//         exported.push(...records);
//       },
//     },
//     {
//       maxQueueSize: 10,
//       maxExportBatchSize: 2,
//       scheduledDelayMs: 60_000,
//       shutdownTimeoutMs: 5_000,
//       fullQueuePolicy: 'drop-newest',
//       diagnostics: { warnOnExportFailure: false },
//     },
//   );

//   for (let i = 0; i < 5; i++) {
//     tee.handle({
//       level: 'info',
//       message: `log-${i}`,
//       serviceName: 'repro',
//       timestamp: Date.now(),
//     });
//   }

//   await tee.flushAll();

//   console.log(exported.length); // 2, not 5
// }

// main();

// import { MetricsRegistry } from './core/metrics/registry';
// import { MetricsExportScheduler } from './core/metrics/exporter-scheduler';

// async function main() {
//   let exports = 0;

//   const registry = new MetricsRegistry({ maxSeriesPerMetric: 100 });
//   registry.counter('jobs_total', 'jobs').inc(1);

//   const scheduler = new MetricsExportScheduler(
//     registry,
//     {
//       async export() {
//         exports++;
//       },
//     },
//     {
//       scheduledDelayMs: 60_000,
//       shutdownTimeoutMs: 5_000,
//     },
//   );

//   await scheduler.shutdown();

//   console.log(exports); // 0, expected 1
// }

// main();

// import { Writable } from 'node:stream';
// import { LogsPipeline } from './core/logger/pipeline';
// import { LogEvent } from './core';

// async function main() {
//   const writes: string[] = [];

//   class SlowWriter extends Writable {
//     _write(chunk: Buffer, _enc: BufferEncoding, cb: Function) {
//       writes.push(chunk.toString());
//       setTimeout(() => cb(), 50);
//     }
//   }

//   const pipeline = new LogsPipeline({
//     writer: new SlowWriter({ highWaterMark: 1024 } as any),
//     maxQueueBytes: 1024 * 1024,
//     fullQueuePolicy: 'drop-newest',
//     formatter: { format: (e: LogEvent) => e.message },
//   });

//   pipeline.handle({
//     level: 'info',
//     message: 'hello',
//     serviceName: 'repro',
//     timestamp: Date.now(),
//   });

//   await pipeline.flushAll();

//   console.log(writes); // can contain "hello\n" twice
// }

// main();

import { withTimeout } from './exporters/circuit-breaker';
import { RetryingTraceExporter } from './exporters/retry';

async function main() {
  //   console.time('process');

  //   await withTimeout(Promise.resolve('done'), 5000, 'timeout');
  //   console.log('promise resolved');

  //   // Process can remain alive until the 5s timeout fires.
  //   process.on('exit', () => console.timeEnd('process'));

  const exporter = new RetryingTraceExporter(
    {
      async export() {
        console.log('attempt');
        throw new Error('down');
      },
    },
    {
      maxRetries: 10,
      initialDelayMs: 1000,
      maxDelayMs: 1000,
    },
  );

  await withTimeout(exporter.export([{}]), 100, 'shutdown timeout').catch((e) =>
    console.log(e.message),
  );

  console.log('shutdown path continued');
}

main();
