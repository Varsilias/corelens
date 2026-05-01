import { Context, Hono } from 'hono';
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
      let route = this.resolveRoute(c);

      try {
        await next();
        status = c.res.status;
      } catch (err) {
        throw err;
      } finally {
        const method = c.req.method;
        const durationSeconds = (performance.now() - start) / 1000;

        recorder.record({ method, route, status, durationSeconds });
      }
    });
  }

  private resolveRoute(c: Context): string {
    try {
      const matched = c.req.matchedRoutes;

      if (!matched || matched.length === 0) {
        return new URL(c.req.url).pathname ?? 'unmatched_route';
      }

      // Filter out the wildcard middleware route ('*') registered by this adapter,
      // then take the last remaining entry which is the actual handler.
      const handlerRoute = [...matched]
        .reverse()
        .find((r) => r.path !== '*' && r.path !== '/*');

      return (
        handlerRoute?.path ?? new URL(c.req.url).pathname ?? 'unmatched_route'
      );
    } catch {
      return 'unmatched_route';
    }
  }
}
