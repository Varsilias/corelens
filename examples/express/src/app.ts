import express from 'express';

import {
  registerCorelens,
  renderMetrics,
  getCorelensStats,
  logger,
} from './config/corelens';
import { errorHandler } from './middleware/error-handler';
import { rateLimit } from './middleware/rate-limit';
import { trackSession } from './middleware/session';
import { routes } from './routes';

export function buildApp() {
  const app = express();

  app.use(express.json());
  registerCorelens(app);

  // General logger for every request that hits the server
  // this is also used to show log enrichment with trace data if turned on
  app.use((_req, res, next) => {
    const start = Date.now();

    const duration = Date.now() - start;
    logger.info('Request processed', {
      method: _req.method,
      path: _req.path,
      status: res.status,
      duration: `${duration}ms`,
    });
    next();
  });

  app.get('/', (_req, res) => {
    res.send('Welcome to Corelens Ecommerce Example App');
  });
  app.get('/health', (_req, res) => {
    res.json({ status: 'ok' });
  });

  app.get('/metrics', (_req, res) => {
    res.set('Content-Type', 'text/plain');
    res.send(renderMetrics());
  });

  app.get('/debug/stats', (_req, res) => {
    res.json(getCorelensStats());
  });

  app.use(trackSession);
  app.use(rateLimit);
  app.use('/api', routes);

  app.use((req, res) => {
    res.status(404).json({ error: 'Not found', path: req.path });
  });

  app.use(errorHandler);

  return app;
}
