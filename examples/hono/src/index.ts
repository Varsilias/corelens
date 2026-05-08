import { serve } from '@hono/node-server';

import { buildApp } from './app';
import { lens, logger } from './config/corelens';

const port = Number(process.env.PORT ?? 3200);
const hostname = process.env.HOST ?? '127.0.0.1';
const upstreamBaseUrl =
  process.env.CATALOG_BASE_URL ?? `http://${hostname}:${port}`;

const app = buildApp(upstreamBaseUrl);

const server = serve({
  fetch: app.fetch,
  port,
  hostname,
});

logger.info(`corelens-hono-gateway running on http://${hostname}:${port}`);

let shuttingDown = false;

async function shutdown(signal: string) {
  if (shuttingDown) return;
  shuttingDown = true;

  console.info(`Received ${signal}. Shutting down...`);

  server.close(async (error) => {
    if (error) {
      logger.error('Failed to close Hono server', {
        message: error.message,
      });
      process.exitCode = 1;
    }

    await lens.shutdown();
  });
}

for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.on(signal, () => {
    void shutdown(signal);
  });
}
