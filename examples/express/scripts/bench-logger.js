#!/usr/bin/env node

require('dotenv/config');
require('ts-node/register');
require('tsconfig-paths/register');

const { performance } = require('node:perf_hooks');
const { corelens } = require('@varsilias/corelens');
const { loggerMessages } = require('./lib/config');

async function main() {
  const lens = corelens({
    serviceName: 'corelens-logger-benchmark',
    logs: {
      enabled: true,
      maxQueueBytes: 32 * 1024 * 1024,
      fullQueuePolicy: 'drop-oldest',
      enrichWithTraceContext: true,
    },
    metrics: { enabled: false },
    traces: { enabled: true },
  });

  const startedAt = performance.now();

  await lens.tracer.withSpan('bench.logger.flood', async () => {
    for (let index = 0; index < loggerMessages; index += 1) {
      lens.logger.info('benchmark log event', {
        index,
        component: 'logger-benchmark',
      });
    }
  });

  await lens.shutdown();

  const elapsedSeconds = (performance.now() - startedAt) / 1000;
  console.log(
    JSON.stringify(
      {
        messages: loggerMessages,
        elapsedSeconds: Number(elapsedSeconds.toFixed(2)),
        messagesPerSecond: Number((loggerMessages / elapsedSeconds).toFixed(2)),
        stats: lens.getStats().logs,
      },
      null,
      2,
    ),
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
