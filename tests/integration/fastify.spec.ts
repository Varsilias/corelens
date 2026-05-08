import fastify from 'fastify';
import {
  FastifyMetricsAdapter,
  FastifyTracingAdapter,
} from '../../src/adapter';
import {
  captureStdout,
  createIntegrationLens,
  metricSample,
  parsedLog,
} from './framework-helpers';

describe('fastify integration', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('records route metrics, traces, and route-handler log enrichment', async () => {
    captureStdout();
    const lens = createIntegrationLens();
    const app = fastify();
    new FastifyMetricsAdapter().register(app, lens.httpMetricsRecorder);
    new FastifyTracingAdapter().register(app, lens.httpTracingRecorder);
    app.get('/users/:id', async (request, reply) => {
      lens.logger.info('fastify handler', { id: (request.params as any).id });
      return reply.status(202).send({ ok: true });
    });
    app.get('/health', async (_request, reply) => reply.status(204).send());

    try {
      const res = await app.inject({
        method: 'GET',
        url: '/users/42',
        headers: {
          traceparent:
            '00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01',
        },
      });
      await app.inject({ method: 'GET', url: '/health' });

      expect(res.statusCode).toBe(202);
      await lens.shutdown();

      expect(
        metricSample(lens, 'http_requests_total', {
          method: 'GET',
          route: '/users/:id',
          status: '202',
        })?.value,
      ).toBe(1);
      expect(
        metricSample(lens, 'http_requests_total', {
          method: 'GET',
          route: '/health',
          status: '204',
        }),
      ).toBeUndefined();
      expect(lens.getStats().traces.snapshot).toMatchObject({
        startedCount: 1,
        endedCount: 1,
        exportedCount: 1,
      });

      const log = parsedLog(
        (process.stdout.write as jest.Mock).mock.calls.map(([line]) => line),
        'fastify handler',
      );
      expect(log).toMatchObject({
        message: 'fastify handler',
        traceId: '4bf92f3577b34da6a3ce929d0e0e4736',
      });
      expect(log.spanId).toEqual(expect.any(String));
    } finally {
      await app.close();
      await lens.shutdown();
    }
  });

  it('records error responses without stalling Fastify hooks', async () => {
    captureStdout();
    const lens = createIntegrationLens();
    const app = fastify();
    new FastifyMetricsAdapter().register(app, lens.httpMetricsRecorder);
    new FastifyTracingAdapter().register(app, lens.httpTracingRecorder);
    app.get('/fail', async () => {
      throw new Error('boom');
    });

    try {
      const res = await app.inject({ method: 'GET', url: '/fail' });
      await lens.shutdown();

      expect(res.statusCode).toBe(500);
      expect(
        metricSample(lens, 'http_requests_total', {
          method: 'GET',
          route: '/fail',
          status: '500',
        })?.value,
      ).toBe(1);
      expect(lens.getStats().traces.snapshot).toMatchObject({
        startedCount: 1,
        endedCount: 1,
      });
    } finally {
      await app.close();
      await lens.shutdown();
    }
  });
});
