import { Hono } from 'hono';
import { routePath } from 'hono/route';

import {
  HttpMetricsAdapter,
  HttpMetricsRecorder,
} from '../http-metrics-recorder';

export class HonoMetricsAdapter implements HttpMetricsAdapter<Hono> {
  register(app: Hono, recorder: HttpMetricsRecorder): void {
    if (!recorder.isEnabled) {
      console.warn(
        '[Corelens] Hono http metrics adapter registered but HTTP metric collection is disabled.',
      );
      return;
    }

    app.use('*', async (c, next) => {
      const start = performance.now();

      let status = 500;
      let route = 'unmatched_route';

      try {
        await next();
        status = c.res.status;
        route = routePath(c) || 'unmatched_route';
      } catch (err) {
        throw err;
      } finally {
        const method = c.req.method;
        const durationSeconds = (performance.now() - start) / 1000;

        recorder.record({
          method,
          route,
          status,
          durationSeconds,
        });
      }
    });
  }
}
