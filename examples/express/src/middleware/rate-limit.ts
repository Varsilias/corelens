import type { Request, Response, NextFunction } from 'express';

import { redis } from '../config/redis';
import { tracer } from '../config/corelens';

const windowSeconds = Number(process.env.RATE_LIMIT_WINDOW_SECONDS ?? 60);
const maxRequests = Number(process.env.RATE_LIMIT_MAX ?? 120);

export async function rateLimit(req: Request, res: Response, next: NextFunction) {
  try {
    const key = `rate-limit:${req.ip}`;

    const count = await tracer.withSpan('redis.rate_limit.increment', async (span) => {
      span.setAttribute('rate_limit.key', key);
      const current = await redis.incr(key);

      if (current === 1) {
        await redis.expire(key, windowSeconds);
      }

      return current;
    });

    res.setHeader('x-rate-limit-limit', maxRequests);
    res.setHeader('x-rate-limit-remaining', Math.max(maxRequests - count, 0));

    if (count > maxRequests) {
      res.status(429).json({ error: 'Too many requests' });
      return;
    }

    next();
  } catch (error) {
    next(error);
  }
}
