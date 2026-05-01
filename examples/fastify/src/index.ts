import Fastify from 'fastify';
import {
  corelens,
  FastifyMetricsAdapter,
  FastifyTracingsAdapter,
  PrometheusTextExporter,
} from '@varsilias/corelens';

const fastify = Fastify({ logger: false }); // Disable default logger to use Corelens
const port = 3100;

const lens = corelens({
  serviceName: 'fastify-test-app',
  logs: {
    enabled: true,
    maxQueueBytes: 1024 * 1024, // 1MB for testing
    fullQueuePolicy: 'drop-oldest',
    timestamp: {
      format: 'iso',
    },
    format: 'json',
    colorize: true,
    enrichWithTraceContext: true,
  },
  metrics: {
    enabled: true,
    http: {
      enabled: true,
    },
  },
  traces: {
    enabled: true,
    http: {
      enabled: true,
    },
  },
});

const logger = lens.logger;
const metrics = lens.metrics;
const tracer = lens.tracer;

const exporter = new PrometheusTextExporter();

const adapter = new FastifyMetricsAdapter();
adapter.register(fastify, lens.httpMetricsRecorder);
const tracingAdapter = new FastifyTracingsAdapter();
tracingAdapter.register(fastify, lens.httpTracingRecorder);

const requestTotal = metrics.counter(
  'example_http_requests_total',
  '[Custom] Total number of HTTP request sent to our server',
);
const httpDur = metrics.histogram(
  'example_http_request_duration_seconds',
  '[Custom] HTTP request duration sent to our server',
  {
    buckets: [0.01, 0.05, 0.1, 0.5, 1],
  },
);

fastify.get('/', async () => {
  return 'Corelens Fastify Test Server is running!';
});

fastify.get('/api/data', async () => {
  requestTotal.inc();
  return { data: 'Hello from Fastify' };
});

fastify.get('/api/work/:id', async (request, reply) => {
  // tracer.withSpan(`${request.method} ${request.url}`, async () => {
  //   requestTotal.inc();
  //   const start = performance.now();

  //   // Simulate varying work
  //   const delay = Math.random() * 100;
  //   await new Promise((r) => setTimeout(r, delay));

  //   const duration = (performance.now() - start) / 1000;
  //   httpDur.observe(duration, { method: 'GET', path: '/work' });
  //   logger.info('work-done');
  //   return reply.send('done');
  // });
  requestTotal.inc();
  const start = performance.now();

  // Simulate varying work
  const delay = Math.random() * 100;
  await new Promise((r) => setTimeout(r, delay));

  const duration = (performance.now() - start) / 1000;
  httpDur.observe(duration, { method: 'GET', path: '/work' });
  logger.info('work-done');
  return reply.send('done');
});

fastify.get('/api/error', async (request, reply) => {
  return tracer.withSpan('/api/error', async () => {
    requestTotal.inc();
    try {
      throw new Error('Critical API Failure');
    } catch (error) {
      logger.error('Critical API Failure', { code: 'ERR_500' });
      reply.status(500).send({ error: 'Internal Server Error' });
    }
  });
});

fastify.get('/metrics', async (request, reply) => {
  reply.type('text/plain');
  return exporter.render(lens.getMetricsSnapshot());
});

fastify.get('/debug/stats', async () => {
  return lens.getStats();
});

fastify.setNotFoundHandler((request, reply) => {
  console.log('Reached fallback:', request.method, request.url);

  reply.status(404).send({
    error: 'Not found',
    path: request.url,
  });
});

fastify.setErrorHandler((error: any, request, reply) => {
  logger.error('Uncaught Exception', {
    message: error.message,
    stack: error.stack,
  });

  reply.status(500).send({ error: 'Something went wrong' });
});

const start = async () => {
  try {
    await fastify.listen({ port });
    logger.info(`fastify-test-app running on port ${port}`);
  } catch (err: any) {
    if (err.code === 'EADDRINUSE') {
      console.error(`Port ${port} is already in use!`);
      process.exit(1);
    }
    console.error(err);
    process.exit(1);
  }
};

start();

const gracefulShutdown = async () => {
  console.log('\nShutting down gracefully...');

  await fastify.close();
  console.log('Fastify server closed.');

  await lens.shutdown();
  console.log('Corelens SDK flushed and shut down.');

  process.exit(0);
};

// Listen for termination signals
['SIGINT', 'SIGTERM'].forEach((signal) => {
  process.on(signal, gracefulShutdown);
});
