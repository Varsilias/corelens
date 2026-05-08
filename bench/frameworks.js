#!/usr/bin/env node
const {
  measure,
  resultPath,
  resolveOptional,
  skipped,
  writeReport,
} = require('./lib/runner');

const ITERATIONS = Number(process.env.BENCH_ITERATIONS ?? 5_000);

function createLens() {
  const { corelens } = require('../dist/src');
  return corelens({
    serviceName: 'bench-frameworks',
    logs: { enabled: false },
    metrics: { enabled: true, http: { enabled: true } },
    traces: { enabled: true, samplingRate: 1, http: { enabled: true } },
    export: { enabled: false },
    diagnostics: { enabled: false },
  });
}

async function benchExpress() {
  const express = resolveOptional('express');
  if (!express) {
    return [
      skipped(
        'Express disabled route',
        'Install express to run this benchmark.',
      ),
    ];
  }

  const lens = createLens();
  const {
    ExpressMetricsAdapter,
    ExpressTracingAdapter,
  } = require('../dist/src/adapter');
  const middlewares = [];
  const app = {
    use: (middleware) => middlewares.push(middleware),
  };

  new ExpressMetricsAdapter().register(app, lens.httpMetricsRecorder);
  new ExpressTracingAdapter().register(app, lens.httpTracingRecorder);

  const enabled = await measure(
    'Express instrumentation route',
    () =>
      new Promise((resolve, reject) => {
        const req = {
          method: 'GET',
          path: '/users/123',
          route: { path: '/users/:id' },
          originalUrl: '/users/123',
          headers: {},
          get: () => undefined,
        };
        const listeners = {};
        const res = {
          statusCode: 200,
          on: (event, listener) => {
            listeners[event] = listener;
          },
        };
        let index = 0;
        const next = (error) => {
          if (error) {
            reject(error);
            return;
          }
          const middleware = middlewares[index++];
          if (middleware) {
            middleware(req, res, next);
            return;
          }
          listeners.finish?.();
          resolve();
        };
        next();
      }),
    { iterations: ITERATIONS },
  );

  await lens.shutdown();

  const disabled = await measure(
    'Express bare route',
    () =>
      new Promise((resolve) => {
        const res = { statusCode: 200 };
        void res;
        resolve();
      }),
    { iterations: ITERATIONS },
  );

  return [enabled, disabled];
}

async function benchFastify() {
  const fastify = resolveOptional('fastify');
  if (!fastify) {
    return [
      skipped(
        'Fastify disabled route',
        'Install fastify to run this benchmark.',
      ),
    ];
  }

  const {
    FastifyMetricsAdapter,
    FastifyTracingAdapter,
  } = require('../dist/src/adapter');
  const lens = createLens();
  const app = fastify({ logger: false });
  new FastifyMetricsAdapter().register(app, lens.httpMetricsRecorder);
  new FastifyTracingAdapter().register(app, lens.httpTracingRecorder);
  app.get('/users/:id', async () => ({ ok: true }));
  await app.ready();

  const enabled = await measure(
    'Fastify instrumentation route',
    async () => {
      const response = await app.inject({ method: 'GET', url: '/users/123' });
      if (response.statusCode !== 200) {
        throw new Error(`unexpected status ${response.statusCode}`);
      }
    },
    { iterations: ITERATIONS },
  );

  await app.close();
  await lens.shutdown();

  const bare = fastify({ logger: false });
  bare.get('/users/:id', async () => ({ ok: true }));
  await bare.ready();

  const disabled = await measure(
    'Fastify bare route',
    async () => {
      const response = await bare.inject({ method: 'GET', url: '/users/123' });
      if (response.statusCode !== 200) {
        throw new Error(`unexpected status ${response.statusCode}`);
      }
    },
    { iterations: ITERATIONS },
  );

  await bare.close();
  return [enabled, disabled];
}

async function benchHono() {
  const hono = resolveOptional('hono');
  if (!hono) {
    return [
      skipped('Hono disabled route', 'Install hono to run this benchmark.'),
    ];
  }

  const { Hono } = hono;
  const {
    HonoMetricsAdapter,
    HonoTracingAdapter,
  } = require('../dist/src/adapter');
  const lens = createLens();
  const app = new Hono();
  new HonoMetricsAdapter().register(app, lens.httpMetricsRecorder);
  new HonoTracingAdapter().register(app, lens.httpTracingRecorder);
  app.get('/users/:id', (context) => context.json({ ok: true }));

  const enabled = await measure(
    'Hono instrumentation route',
    async () => {
      const response = await app.fetch(
        new Request('http://localhost/users/123'),
      );
      if (response.status !== 200) {
        throw new Error(`unexpected status ${response.status}`);
      }
    },
    { iterations: ITERATIONS },
  );

  await lens.shutdown();

  const bare = new Hono();
  bare.get('/users/:id', (context) => context.json({ ok: true }));

  const disabled = await measure(
    'Hono bare route',
    async () => {
      const response = await bare.fetch(
        new Request('http://localhost/users/123'),
      );
      if (response.status !== 200) {
        throw new Error(`unexpected status ${response.status}`);
      }
    },
    { iterations: ITERATIONS },
  );

  return [enabled, disabled];
}

async function main() {
  const rows = [
    ...(await benchExpress()),
    ...(await benchFastify()),
    ...(await benchHono()),
  ];

  const report = writeReport({
    title: 'Corelens Framework Adapter Benchmark',
    outputFile: resultPath('BENCHMARK_FRAMEWORK_RESULTS.md'),
    description:
      'Local request-path benchmark for Express, Fastify, and Hono with Corelens metrics and tracing instrumentation enabled compared to bare request handling.',
    rows,
    metadata: [`Iterations per route: ${ITERATIONS.toLocaleString()}`],
  });

  process.stdout.write(report);
}

main().catch((error) => {
  process.stderr.write(
    `${error instanceof Error ? error.stack : String(error)}\n`,
  );
  process.exitCode = 1;
});
