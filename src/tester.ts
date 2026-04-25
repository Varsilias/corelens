import { CorelensConfig } from './core/config';
import { corelens } from './core/orchestrator';

const config = {
  serviceName: 'payment-service',
  logs: {
    enabled: true,
    fullQueuePolicy: 'drop-newest',
    maxQueueBytes: 4 * 1024 * 1024,
    reportStatsOnShutdown: true,
    writer: {
      highWaterMark: 64 * 1024,
    },
  },
  metrics: {
    enabled: true,
    runtime: {
      enabled: true,
      intervalMs: 10000,
    },
  },
  traces: true,
  lifecycle: {
    handleProcessSignals: true,
  },
} as CorelensConfig;

async function main() {
  //   const startMemory = process.memoryUsage();
  //   const start = performance.now();
  //   const lens = corelens(config);
  //   const logger = lens.logger;
  //   for (let i = 0; i < 100_000; i++) {
  //     logger.info('test', { i });
  //   }
  //   const produceEnd = performance.now();
  //   const flushStart = performance.now();
  //   await lens.shutdown();
  //   const flushEnd = performance.now();
  //   const endMemory = process.memoryUsage();
  //   const memoryDiff = {
  //     rss: (endMemory.rss - startMemory.rss) / 1024 / 1024,
  //     heapUsed: (endMemory.heapUsed - startMemory.heapUsed) / 1024 / 1024,
  //   };
  //   console.log({
  //     produceTimeMs: produceEnd - start,
  //     flushTimeMs: flushEnd - flushStart,
  //     totalTimeMs: flushEnd - start,
  //     memoryDiff,
  //     stats: lens.getStats(),
  //   });

  const startMemory = process.memoryUsage();
  const start = performance.now();

  const lens = corelens(config);
  const metrics = lens.metrics;

  const counter = metrics.counter('requests_total');
  counter.inc();
  counter.inc(5);

  const memory = metrics.gauge('memory_usage_bytes');
  memory.set(process.memoryUsage().heapUsed);

  const snapshot = metrics.snapshot();
  console.log(JSON.stringify(snapshot, null, 2));

  const end = performance.now();
  const endMemory = process.memoryUsage();

  const memoryDiff = {
    rss: (endMemory.rss - startMemory.rss) / 1024 / 1024,
    heapUsed: (endMemory.heapUsed - startMemory.heapUsed) / 1024 / 1024,
  };
  console.log({
    totalTimeMs: end - start,
    memoryDiff,
    // stats: lens.getStats(),
  });
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
