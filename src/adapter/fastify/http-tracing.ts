import { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';

import {
  HttpTracingAdapter,
  HttpTracingRecorder,
} from '../http-tracing-recorder';
import { ISpan } from '../../core/traces/span';

type CorelensFastifyRequest = FastifyRequest & {
  corelensSpan?: ReturnType<HttpTracingRecorder['start']>;
};

export class FastifyTracingsAdapter implements HttpTracingAdapter<FastifyInstance> {
  register(app: FastifyInstance, recorder: HttpTracingRecorder): void {
    if (!recorder.isEnabled) {
      console.warn(
        '[Corelens] Fastify http tracing adapter registered but HTTP tracing is disabled.',
      );
      return;
    }

    app.addHook('onRequest', (request: CorelensFastifyRequest, reply, done) => {
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
        recorder.enterWithSpan(span);
        done();
      } catch (err) {
        console.warn('[Corelens] Failed to start trace span:', err);
      }
    });

    app.addHook(
      'preHandler',
      (request: CorelensFastifyRequest, reply, done) => {
        recorder.enterWithSpan(request.corelensSpan);
        done();
      },
    );

    app.addHook(
      'onError',
      (request: any, reply: FastifyReply, error: Error) => {
        try {
          const span = request.corelensSpan as ISpan;
          if (!span) return;
          span.recordException(error);
        } catch (err) {
          console.warn('[Corelens] Failed to record exception on span:', err);
        }
      },
    );

    app.addHook(
      'onResponse',
      (request: CorelensFastifyRequest, reply: FastifyReply, done) => {
        const span = request.corelensSpan;

        const route =
          request.routeOptions?.url || request.url || 'unmatched_route';

        span?.setAttribute('http.route', route);

        recorder.end(span, {
          status: reply.statusCode,
        });

        done();
      },
    );
  }
}
