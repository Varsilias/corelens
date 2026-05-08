import { buildApp } from './app';
import { lens, logger } from './config/corelens';

const port = Number(process.env.PORT ?? 3100);
const host = process.env.HOST ?? '127.0.0.1';

async function bootstrap() {
  const app = await buildApp();

  try {
    await app.listen({ port, host });
    logger.info(`corelens-fastify-todos running on http://${host}:${port}`);
  } catch (error) {
    logger.error('Failed to start Fastify server', {
      message: error instanceof Error ? error.message : String(error),
    });
    await lens.shutdown();
    process.exit(1);
  }

  let shuttingDown = false;

  for (const signal of ['SIGINT', 'SIGTERM'] as const) {
    process.on(signal, async () => {
      if (shuttingDown) return;
      shuttingDown = true;

      console.info(`Received ${signal}. Shutting down...`);

      await app.close();
      await lens.shutdown();
      process.exitCode = 0;
    });
  }
}

bootstrap().catch(async (error) => {
  logger.error('Fastify bootstrap failed', {
    message: error instanceof Error ? error.message : String(error),
  });
  await lens.shutdown();
  process.exit(1);
});
