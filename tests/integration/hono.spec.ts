import { Hono } from 'hono';
import { HonoMetricsAdapter, HonoTracingAdapter } from '../../src/adapter';
import {
  captureStdout,
  createIntegrationLens,
  metricSample,
  parsedLog,
} from './framework-helpers';

describe('hono integration', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('records route metrics, traces, and route-handler log enrichment', async () => {
    captureStdout();
    const lens = createIntegrationLens();
    const app = new Hono();
    new HonoMetricsAdapter().register(app, lens.httpMetricsRecorder);
    new HonoTracingAdapter().register(app, lens.httpTracingRecorder);
    app.get('/users/:id', (c) => {
      lens.logger.info('hono handler', { id: c.req.param('id') });
      return c.json({ ok: true }, 203);
    });
    app.get('/health', (c) => c.body(null, 204));

    const res = await app.fetch(
      new Request('http://localhost/users/42', {
        headers: {
          traceparent:
            '00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01',
        },
      }),
    );
    await app.fetch(new Request('http://localhost/health'));
    await lens.shutdown();

    expect(res.status).toBe(203);
    expect(
      metricSample(lens, 'http_requests_total', {
        method: 'GET',
        route: '/users/:id',
        status: '203',
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
      'hono handler',
    );
    expect(log).toMatchObject({
      message: 'hono handler',
      traceId: '4bf92f3577b34da6a3ce929d0e0e4736',
    });
    expect(log.spanId).toEqual(expect.any(String));
  });

  it('records error responses and marks trace lifecycle complete', async () => {
    captureStdout();
    const lens = createIntegrationLens();
    const app = new Hono();
    new HonoMetricsAdapter().register(app, lens.httpMetricsRecorder);
    new HonoTracingAdapter().register(app, lens.httpTracingRecorder);
    app.onError((_error, c) => c.text('Internal Server Error', 500));
    app.get('/fail', () => {
      throw new Error('boom');
    });

    const res = await app.fetch(new Request('http://localhost/fail'));
    await lens.shutdown();

    expect(res.status).toBe(500);
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
  });
});
