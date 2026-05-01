import { Express } from 'express';

import {
  HttpTracingAdapter,
  HttpTracingRecorder,
} from '../http-tracing-recorder';

export class ExpressTracingAdapter implements HttpTracingAdapter<Express> {
  register(app: Express, recorder: HttpTracingRecorder): void {
    if (!recorder.isEnabled) {
      console.warn(
        '[Corelens] Express tracing adapter registered but HTTP tracing is disabled.',
      );
      return;
    }

    app.use((req, res, next) => {
      try {
        const initialRoute = req?.path || 'unmatched_route';

        const span = recorder.start({
          method: req.method,
          route: initialRoute,
          target: req.originalUrl ?? req.url,
          protocol: req.protocol,
          userAgent: req.headers['user-agent'],
          traceparent: req.headers['traceparent'] as string,
        });

        recorder.enterWithSpan(span);

        res.on('finish', () => {
          try {
            const finalRoute = req.route?.path || initialRoute;

            span?.setAttribute('http.route', finalRoute);
            recorder.end(span, { status: res.statusCode });
          } catch (err) {
            console.warn('[Corelens] Failed to end trace span:', err);
          }
        });

        next();
      } catch (err) {
        console.warn('[Corelens] Failed to start trace span:', err);
        next();
      }
    });
  }
}
