import { randomUUID } from 'node:crypto';
import type { Request, Response, NextFunction } from 'express';

import { redis } from '../config/redis';
import { tracer } from '../config/corelens';

const ttlSeconds = Number(process.env.SESSION_TTL_SECONDS ?? 60 * 30);

export async function trackSession(req: Request, res: Response, next: NextFunction) {
  try {
    const sessionId = req.header('x-session-id') ?? randomUUID();
    res.setHeader('x-session-id', sessionId);

    await tracer.withSpan('redis.session.track', async (span) => {
      span.setAttribute('session.id', sessionId);
      await redis.hSet(`session:${sessionId}`, {
        lastPath: req.path,
        lastMethod: req.method,
        updatedAt: new Date().toISOString(),
      });
      await redis.expire(`session:${sessionId}`, ttlSeconds);
    });

    next();
  } catch (error) {
    next(error);
  }
}
