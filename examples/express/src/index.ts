import express from 'express';
import {
  corelens,
  PrometheusTextExporter,
  ExpressMetricsAdapter,
} from '@varsilias/corelens';

const app = express();
const port = 3000;

const lens = corelens({
  serviceName: 'express-test-app',
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

const logger = lens.logger;
const metrics = lens.metrics;

const adapter = new ExpressMetricsAdapter();
adapter.register(app, lens.httpRecorder);

const httpDur = metrics.histogram(
  'example_http_request_duration_seconds',
  '[Custom] HTTP request duration sent to our server',
  {
    buckets: [0.01, 0.05, 0.1, 0.5, 1],
  },
);

const exporter = new PrometheusTextExporter();

app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    logger.info(`Request processed`, {
      method: req.method,
      path: req.path,
      status: res.statusCode,
      duration: `${duration}ms`,
    });
  });
  next();
});

// metrics
const requestTotal = metrics.counter(
  'example_http_requests_total',
  '[Custom] Total number of HTTP request sent to our server',
);

app.get('/', (req, res) => {
  res.send('Corelens Test Server is running!');
});

app.get('/api/data', (req, res) => {
  requestTotal.inc(); // increment request total
  res.json({ data: 'Hello from Corelens' });
});

app.get('/api/work/:id', async (req, res) => {
  requestTotal.inc();
  const start = performance.now();

  // Simulate varying work
  const delay = Math.random() * 100;
  await new Promise((r) => setTimeout(r, delay));

  const duration = (performance.now() - start) / 1000;
  httpDur.observe(duration, { method: 'GET', path: '/work' });

  return res.send('done');
});

app.get('/api/error', (req, res) => {
  requestTotal.inc();

  logger.error('Critical API Failure', { code: 'ERR_500' });
  res.status(500).json({ error: 'Internal Server Error' });
});

app.get('/metrics', (req, res) => {
  res.set('Content-Type', 'text/plain');
  res.send(exporter.render(metrics.snapshot()));
});

app.get('/debug/stats', (req, res) => {
  res.json(lens.getStats());
});

app.use((req, res, next) => {
  console.log('Reached fallback:', req.method, req.path);
  res.status(404).json({ error: 'Not found', path: req.path });
});

const server = app.listen(port, () => {
  console.log(`express-test-app running on port ${port}`);
});

server.on('error', (e: any) => {
  console.log(e);
  if (e.code === 'EADDRINUSE') {
    console.error(`Port ${port} is already in use!`);
    process.exit(1);
  } else {
    console.error(e);
  }
});

let shuttingDown = false;

for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.on(signal, async () => {
    if (shuttingDown) return;
    shuttingDown = true;

    console.log(`\nReceived ${signal}. Shutting down...`);

    await lens.shutdown();

    server.close(() => {
      console.log('Server closed.');
      process.exitCode = 0;
    });
  });
}
