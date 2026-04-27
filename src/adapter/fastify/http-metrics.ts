import { FastifyInstance, FastifyReply } from 'fastify';
import {
  HttpMetricsAdapter,
  HttpMetricsRecorder,
} from '../http-metrics-recorder';

export class FastifyMetricsAdapter implements HttpMetricsAdapter<FastifyInstance> {
  register(app: FastifyInstance, recorder: HttpMetricsRecorder): void {
    if (!recorder.isEnabled) {
      return;
    }

    app.addHook('onRequest', async (request: any) => {
      request.corelensStartTime = performance.now();
    });

    // Use 'onResponse' to record the final data
    app.addHook('onResponse', async (request: any, reply: FastifyReply) => {
      const start = request.corelensStartTime;
      if (!start) return;

      const durationSeconds = (performance.now() - start) / 1000;

      const route = request.routeOptions?.url || 'unmatched_route';
      const method = request.method;
      const status = reply.statusCode;

      recorder.record({
        method,
        route,
        status,
        durationSeconds,
      });
    });
  }
}
