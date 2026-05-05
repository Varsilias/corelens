import 'dotenv/config';

import { buildApp } from './app';
import { closeRedis, connectRedis } from './config/redis';
import { lens, logger } from './config/corelens';
import { prisma } from './config/prisma';

const port = Number(process.env.PORT ?? 3000);

process.on('uncaughtException', (err) => {
  console.error('[CRASH]', err);
});

process.on('unhandledRejection', (reason) => {
  console.error('[UNHANDLED REJECTION]', reason);
});

async function bootstrap() {
  await connectRedis();

  const app = buildApp();
  const server = app.listen(port, () => {
    logger.info(`corelens-commerce-example running on port ${port}`);
  });

  server.on('error', (error: NodeJS.ErrnoException) => {
    if (error.code === 'EADDRINUSE') {
      console.error(`Port ${port} is already in use`);
      process.exit(1);
    }

    console.error('Server failed', { message: error.message });
    process.exit(1);
  });

  let shuttingDown = false;

  for (const signal of ['SIGINT', 'SIGTERM'] as const) {
    process.on(signal, async () => {
      if (shuttingDown) return;
      shuttingDown = true;

      console.info(`Received ${signal}. Shutting down...`);

      server.close(async () => {
        await closeRedis();
        await prisma.$disconnect();
        await lens.shutdown();
        process.exitCode = 0;
      });
    });
  }
}

bootstrap().catch(async (error) => {
  logger.error('Failed to start server', {
    message: error instanceof Error ? error.message : String(error),
  });

  await closeRedis();
  await prisma.$disconnect();
  await lens.shutdown();
  process.exit(1);
});
