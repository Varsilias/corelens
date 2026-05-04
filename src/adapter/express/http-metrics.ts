import { Express } from 'express';

import {
  HttpMetricsAdapter,
  HttpMetricsRecorder,
} from '../http-metrics-recorder';

export class ExpressMetricsAdapter implements HttpMetricsAdapter<Express> {
  register(app: Express, recorder: HttpMetricsRecorder): void {
    if (!recorder.isEnabled) {
      console.warn(
        '[Corelens] Express http metrics adapter registered but HTTP metric collection is disabled.',
      );
      return;
    }

    app.use((req, res, next) => {
      const start = performance.now();

      // 1. Attach a listener to the response 'finish' event
      // This waits until the request is fully processed and sent
      res.on('finish', () => {
        try {
          const durationSeconds = (performance.now() - start) / 1000;

          const route = req.route
            ? (req.baseUrl || '') + req.route.path
            : 'unmatched_route';

          const method = req.method;
          const status = res.statusCode;
          recorder.record({
            method,
            route: route,
            status,
            durationSeconds,
          });
        } catch (error) {
          console.error('[Corelens] HTTP Metrics recording failed:', error);
        }
      });

      next();
    });
  }
}
