import { Hono } from 'hono';

import {
  getCorelensStats,
  logger,
  registerCorelens,
  renderMetrics,
} from './config/corelens';
import { registerGatewayRoutes } from './routes/gateway.routes';

export function buildApp(upstreamBaseUrl: string) {
  const app = new Hono();

  registerCorelens(app);

  app.use('*', async (c, next) => {
    const start = performance.now();
    await next();

    logger.info('Request processed', {
      method: c.req.method,
      path: c.req.path,
      status: c.res.status,
      durationMs: Math.round(performance.now() - start),
    });
  });

  app.get('/', (c) => c.text('Welcome to Corelens Hono Gateway Example'));

  app.get('/health', (c) => c.json({ status: 'ok' }));

  app.get('/metrics', (c) => {
    c.header('Content-Type', 'text/plain');
    return c.text(renderMetrics());
  });

  app.get('/debug/stats', (c) => c.json(getCorelensStats()));

  registerGatewayRoutes(app, upstreamBaseUrl);

  app.notFound((c) => {
    return c.json({ error: 'Not found', path: c.req.path }, 404);
  });

  app.onError((error, c) => {
    logger.error('Unhandled Hono error', {
      message: error.message,
      stack: error.stack,
    });

    return c.json({ error: 'Something went wrong' }, 500);
  });

  return app;
}
