import {
  HttpTracingAdapter,
  HttpTracingRecorder,
} from '../http-tracing-recorder';
import { Hono, Context } from 'hono';

export class HonoTracingAdapter implements HttpTracingAdapter<Hono> {
  register(app: Hono, recorder: HttpTracingRecorder): void {
    if (!recorder.isEnabled) {
      console.warn(
        '[Corelens] Hono tracing adapter registered but HTTP tracing is disabled.',
      );
      return;
    }

    app.use('*', async (c: Context, next) => {
      const req = c.req;
      const route = this.resolveRoute(c);

      const span = recorder.start({
        method: req.method,
        route, // resolved after next()
        target: req.url,
        protocol: new URL(c.req.url).protocol.replace(':', ''),
        userAgent: req.header('user-agent'),
        traceparent: req.header('traceparent'),
      });

      recorder.enterWithSpan(span);

      try {
        await next();
        const finalRoute = req.routePath || req.path || route;
        span?.setAttribute('http.route', finalRoute);
        recorder.end(span, {
          status: c.res.status,
        });
      } catch (err) {
        span?.recordException(err);
        span?.setStatus('error');

        recorder.end(span, {
          status: 500,
        });
        throw err;
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
