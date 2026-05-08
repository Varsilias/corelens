#!/usr/bin/env node
const { Writable } = require('node:stream');
const {
  NullWritable,
  measure,
  resultPath,
  resolveOptional,
  skipped,
  writeReport,
} = require('./lib/runner');

const ITERATIONS = Number(process.env.BENCH_ITERATIONS ?? 100_000);
const outputFile = resultPath('BENCHMARK_RESULTS.md');

class SyncNullWritable extends Writable {
  _write(_chunk, _encoding, callback) {
    callback();
  }
}

async function benchCorelens() {
  const stdoutWrite = process.stdout.write;
  process.stdout.write = function (_chunk, _encoding, callback) {
    if (typeof _encoding === 'function') _encoding();
    if (typeof callback === 'function') callback();
    return true;
  };

  try {
    const { corelens } = require('../dist/src');
    const lens = corelens({
      serviceName: 'bench-corelens',
      logs: {
        enabled: true,
        timestamp: { format: 'epoch' },
        level: 'info',
        enrichWithTraceContext: false,
      },
      metrics: { enabled: false },
      traces: { enabled: false },
      export: { enabled: false },
    });

    const result = await measure(
      'Corelens logger.info',
      (i) => {
        lens.logger.info('user created', {
          userId: `user-${i}`,
          route: '/users/:id',
          status: 201,
        });
      },
      { iterations: ITERATIONS },
    );

    await lens.shutdown();
    return result;
  } finally {
    process.stdout.write = stdoutWrite;
  }
}

async function benchPino() {
  const pino = resolveOptional('pino');
  if (!pino) {
    return skipped(
      'Pino logger.info',
      'Install pino as a dev dependency to include this comparison.',
    );
  }

  const destination = new SyncNullWritable();
  const logger = pino(
    {
      timestamp: false,
      base: undefined,
    },
    destination,
  );

  const result = await measure(
    'Pino logger.info',
    (i) => {
      logger.info(
        {
          userId: `user-${i}`,
          route: '/users/:id',
          status: 201,
        },
        'user created',
      );
    },
    { iterations: ITERATIONS },
  );

  destination.end();
  return result;
}

async function benchWinston() {
  const winston = resolveOptional('winston');
  if (!winston) {
    return skipped(
      'Winston logger.info',
      'Install winston as a dev dependency to include this comparison.',
    );
  }

  const transport = new winston.transports.Stream({
    stream: new NullWritable(),
  });
  const logger = winston.createLogger({
    level: 'info',
    format: winston.format.json(),
    transports: [transport],
  });

  const result = await measure(
    'Winston logger.info',
    (i) => {
      logger.info('user created', {
        userId: `user-${i}`,
        route: '/users/:id',
        status: 201,
      });
    },
    { iterations: ITERATIONS },
  );

  logger.close();
  return result;
}

async function main() {
  const rows = [];
  rows.push(await benchCorelens());
  rows.push(await benchPino());
  rows.push(await benchWinston());

  const report = writeReport({
    title: 'Corelens Logger Benchmark',
    outputFile,
    description:
      'Side-by-side local hot-path comparison of Corelens logger.info against Pino and Winston. This benchmark only compares logging API throughput and does not include Corelens metrics or tracing value.',
    rows,
    metadata: [`Iterations per logger: ${ITERATIONS.toLocaleString()}`],
    notes: [
      'Logger comparisons only compare the logging API hot path. Pino and Winston do not provide Corelens metrics or tracing.',
    ],
  });

  process.stdout.write(report);
}

main().catch((error) => {
  process.stderr.write(
    `${error instanceof Error ? error.stack : String(error)}\n`,
  );
  process.exitCode = 1;
});
