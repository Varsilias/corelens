import Fastify from 'fastify';
import {
  corelens,
  FastifyMetricsAdapter,
  PrometheusTextExporter,
} from '@varsilias/corelens';

const fastify = Fastify({ logger: false }); // Disable default logger to use Corelens
const port = 3100;

const sdk = corelens({
  serviceName: 'fastify-test-app',
  logs: {
    enabled: true,
    maxQueueBytes: 1024 * 1024, // 1MB for testing
    fullQueuePolicy: 'drop-oldest',
  },
  metrics: {
    enabled: true,
    http: {
      enabled: true,
    },
  },
});

const logger = sdk.logger;
const metrics = sdk.metrics;
const exporter = new PrometheusTextExporter();

const adapter = new FastifyMetricsAdapter();
adapter.register(fastify, sdk.httpRecorder);

const requestTotal = metrics.counter('example_http_requests_total');
const httpDur = metrics.histogram('example_http_request_duration_seconds', {
  buckets: [0.01, 0.05, 0.1, 0.5, 1],
});

fastify.addHook('onResponse', async (request, reply) => {
  // Log request
  logger.info('Request processed', {
    method: request.method,
    path: request.url,
    status: reply.statusCode,
    duration: `${reply.elapsedTime.toFixed(2)}ms`,
  });
});

fastify.get('/', async () => {
  return 'Corelens Fastify Test Server is running!';
});

fastify.get('/api/data', async () => {
  requestTotal.inc();
  return { data: 'Hello from Fastify' };
});

fastify.get('/api/work/:id', async (requesr, reply) => {
  requestTotal.inc();
  const start = performance.now();

  // Simulate varying work
  const delay = Math.random() * 100;
  await new Promise((r) => setTimeout(r, delay));

  const duration = (performance.now() - start) / 1000;
  httpDur.observe(duration, { method: 'GET', path: '/work' });

  return reply.send('done');
});

fastify.get('/api/error', async (request, reply) => {
  requestTotal.inc();
  logger.error('Critical API Failure', { code: 'ERR_500' });
  reply.status(500).send({ error: 'Internal Server Error' });
});

fastify.get('/metrics', async (request, reply) => {
  reply.type('text/plain');
  return exporter.render(sdk.getMetricsSnapshot());
});

fastify.get('/debug/stats', async () => {
  return sdk.getStats();
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
    console.log(`fastify-test-app running on port ${port}`);
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

  await sdk.shutdown();
  console.log('Corelens SDK flushed and shut down.');

  process.exit(0);
};

// Listen for termination signals
['SIGINT', 'SIGTERM'].forEach((signal) => {
  process.on(signal, gracefulShutdown);
});
