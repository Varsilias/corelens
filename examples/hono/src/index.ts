import { Hono } from 'hono';
import { serve } from '@hono/node-server';
import { corelens, PrometheusTextExporter } from '@varsilias/corelens'; // Your library

const app = new Hono();
const port = 3200;

const sdk = corelens({
  serviceName: 'hono-test-app',
  logs: {
    enabled: true,
    maxQueueBytes: 1024 * 1024, // 1MB for testing
    fullQueuePolicy: 'drop-oldest',
  },
  metrics: {
    enabled: true,
    runtime: {
      enabled: true,
      intervalMs: 2000,
    },
  },
});

const logger = sdk.logger;
const metrics = sdk.metrics;
const exporter = new PrometheusTextExporter();
const requestTotal = metrics.counter('requests_total');

app.use('*', async (c, next) => {
  const start = Date.now();
  await next();
  const duration = Date.now() - start;

  logger.info('Request processed', {
    method: c.req.method,
    path: c.req.path,
    status: c.res.status,
    duration: `${duration}ms`,
  });
});

app.get('/', (c) => c.text('Corelens Hono Test Server is running!'));

app.get('/api/data', (c) => {
  requestTotal.inc();
  return c.json({ data: 'Hello from Hono' });
});

app.get('/api/error', (c) => {
  requestTotal.inc();
  sdk.logger.error('Critical API Failure', { code: 'ERR_500' });
  return c.json({ error: 'Internal Server Error' }, 500);
});

app.get('/metrics', (c) => {
  c.header('Content-Type', 'text/plain');
  return c.text(exporter.render(sdk.getMetricsSnapshot()));
});

app.get('/debug/stats', (c) => c.json(sdk.getStats()));

app.notFound((c) => {
  return c.json({ error: 'Not found', path: c.req.path }, 404);
});

app.onError((err, c) => {
  logger.error('Uncaught Exception', {
    message: err.message,
    stack: err.stack,
  });
  return c.json({ error: 'Something went wrong' }, 500);
});

const server = serve({
  fetch: app.fetch,
  port,
});

const gracefulShutdown = async () => {
  console.log('\nClosing Hono server...');

  server.close(async (err) => {
    if (err) {
      console.error('Error closing server:', err);
      process.exit(1);
    }

    console.log('Hono server stopped.');

    // Flush telemetry
    await sdk.shutdown();
    console.log('Telemetry batch flushed.');

    process.exit(0);
  });
};

['SIGINT', 'SIGTERM'].forEach((signal) => {
  process.on(signal, gracefulShutdown);
});
