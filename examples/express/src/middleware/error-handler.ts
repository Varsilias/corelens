import type { ErrorRequestHandler } from 'express';

import { logger } from '../config/corelens';

export const errorHandler: ErrorRequestHandler = (error, _req, res, _next) => {
  logger.error('Request failed', {
    message: error instanceof Error ? error.message : String(error),
  });

  res.status(500).json({ error: 'Internal server error' });
};
