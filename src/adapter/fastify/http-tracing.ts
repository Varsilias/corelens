import { FastifyInstance, FastifyReply } from 'fastify';

import {
  HttpTracingAdapter,
  HttpTracingRecorder,
} from '../http-tracing-recorder';
import { ISpan } from '../../core/traces/span';

export class FastifyTracingsAdapter implements HttpTracingAdapter<FastifyInstance> {
  register(app: FastifyInstance, recorder: HttpTracingRecorder): void {
    if (!recorder.isEnabled) {
      console.warn(
        '[Corelens] Fastify http tracing adapter registered but HTTP tracing is disabled.',
      );
      return;
    }

    app.addHook('onRequest', async (request: any) => {
      try {
        const route =
          request.routeOptions?.url || request.url || 'unmatched_route';

        const span = recorder.start({
          method: request.method,
          route,
          target: request.url,
          protocol: request.protocol,
          userAgent: request.headers['user-agent'],
          traceparent: request.headers['traceparent'] as string,
        });

        request.corelensSpan = span;
      } catch (err) {
        console.warn('[Corelens] Failed to start trace span:', err);
      }
    });

    app.addHook(
      'onError',
      async (request: any, reply: FastifyReply, error: Error) => {
        try {
          const span = request.corelensSpan as ISpan;
          if (!span) return;
          span.recordException(error);
        } catch (err) {
          console.warn('[Corelens] Failed to record exception on span:', err);
        }
      },
    );

    app.addHook('onResponse', async (request: any, reply: FastifyReply) => {
      try {
        const span = request.corelensSpan as ISpan;
        if (!span) return;

        recorder.runWithSpan(span, () => {
          recorder.end(span, { status: reply.statusCode });
        });
      } catch (err) {
        console.warn('[Corelens] Failed to end trace span:', err);
      }
    });
  }
}
