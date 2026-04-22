import { otel } from './core/orchestrator';

const config = {
  serviceName: 'payment-service',
  logs: true,
  metrics: true,
  traces: true,
};
// const startMemory = process.memoryUsage()
// console.time('otel-init');
// otel({
//   serviceName: 'payment-service',
//   logs: true,
//   metrics: true,
//   traces: true,
// });
// console.timeEnd('otel-init');
// const endMemory = process.memoryUsage()

// const memoryDiff = {
//     rss: (endMemory.rss - startMemory.rss) / 1024/ 1024,
//     heapUsed: (endMemory.heapUsed - startMemory.heapUsed) / 1024/ 1024
// }

// console.log(`Init Memory Increase: ${memoryDiff.rss.toFixed(2)} MB`);

import { performance } from 'perf_hooks';

const start = performance.now();
otel(config);
const end = performance.now();

console.log(`Init time: ${end - start}ms`);
