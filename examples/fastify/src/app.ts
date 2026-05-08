import Fastify from 'fastify';

import {
  getCorelensStats,
  logger,
  registerCorelens,
  renderMetrics,
} from './config/corelens';
import { registerTodoRoutes } from './routes/todo.routes';

export async function buildApp() {
  const app = Fastify({ logger: false });

  registerCorelens(app);

  app.addHook('onResponse', async (request, reply) => {
    logger.info('Request processed', {
      method: request.method,
      path: request.url,
      status: reply.statusCode,
    });
  });

  app.get('/', async () => {
    return 'Welcome to Corelens Fastify Todo Example';
  });

  app.get('/health', async () => {
    return { status: 'ok' };
  });

  app.get('/metrics', async (_request, reply) => {
    reply.type('text/plain');
    return renderMetrics();
  });

  app.get('/debug/stats', async () => {
    return getCorelensStats();
  });

  await registerTodoRoutes(app);

  app.setNotFoundHandler((request, reply) => {
    reply.status(404).send({
      error: 'Not found',
      path: request.url,
    });
  });

  app.setErrorHandler((error: Error, _request, reply) => {
    logger.error('Unhandled Fastify error', {
      message: error.message,
      stack: error.stack,
    });

    reply.status(500).send({ error: 'Something went wrong' });
  });

  return app;
}
