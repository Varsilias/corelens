import { routePath } from 'hono/route';
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
      const span = recorder.start({
        method: c.req.method,
        route: 'unmatched_route', // resolved after next()
        target: c.req.url,
        protocol: new URL(c.req.url).protocol.replace(':', ''),
        userAgent: c.req.header('user-agent'),
        traceparent: c.req.header('traceparent'),
      });

      try {
        await next();
      } catch (err) {
        recorder.runWithSpan(span, () => {
          recorder.end(span, { status: 500 });
        });
        throw err;
      }

      // Route is only known after next() resolves in Hono
      const route = routePath(c) || 'unmatched_route';
      span?.setAttribute('http.route', route);

      recorder.runWithSpan(span, () => {
        recorder.end(span, { status: c.res.status });
      });
    });
  }
}
