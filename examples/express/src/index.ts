import express from 'express';
import { corelens, PrometheusTextExporter } from '@varsilias/corelens'; // Your library

const app = express();
const port = 3000;

const sdk = corelens({
  serviceName: 'express-test-app',
  logs: {
    enabled: true,
    maxQueueBytes: 1024 * 1024, // 1MB for testing
    fullQueuePolicy: 'drop-oldest',
  },
  metrics: {
    enabled: true,
  },
});

const logger = sdk.logger;
const metrics = sdk.metrics;
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
const requestTotal = metrics.counter('requests_total');

app.get('/', (req, res) => {
  res.send('Corelens Test Server is running!');
});

app.get('/api/data', (req, res) => {
  requestTotal.inc(); // increment request total
  res.json({ data: 'Hello from Corelens' });
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
  res.json(sdk.getStats());
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

    await sdk.shutdown();

    server.close(() => {
      console.log('Server closed.');
      process.exitCode = 0;
    });
  });
}
