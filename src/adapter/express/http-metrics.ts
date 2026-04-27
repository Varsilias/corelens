import { Express } from 'express';

import {
  HttpMetricsAdapter,
  HttpMetricsRecorder,
} from '../http-metrics-recorder';

export class ExpressMetricsAdapter implements HttpMetricsAdapter<Express> {
  register(app: Express, recorder: HttpMetricsRecorder): void {
    if (!recorder.isEnabled) {
      return;
    }

    app.use(async (req, res, next) => {
      const start = performance.now();

      let status = 500;

      try {
        next();
        status = res.statusCode;
      } catch (err) {
        throw err;
      } finally {
        const route = req.route.path || 'unmatched_route';
        const method = req.method;
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
