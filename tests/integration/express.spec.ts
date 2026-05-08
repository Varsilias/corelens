import { EventEmitter } from 'node:events';
import {
  ExpressMetricsAdapter,
  ExpressTracingAdapter,
} from '../../src/adapter';
import {
  captureStdout,
  createIntegrationLens,
  metricSample,
  parsedLog,
} from './framework-helpers';

type Middleware = (req: any, res: any, next: () => void) => void;

function createExpressHarness() {
  const middleware: Middleware[] = [];
  const app = {
    use(fn: Middleware) {
      middleware.push(fn);
      return app;
    },
  };

  async function request({
    method = 'GET',
    path,
    routePath,
    status,
    headers = {},
    handler,
  }: {
    method?: string;
    path: string;
    routePath: string;
    status: number;
    headers?: Record<string, string>;
    handler?: (req: any, res: any) => void;
  }) {
    const req: any = {
      method,
      path,
      url: path,
      originalUrl: path,
      protocol: 'http',
      headers,
      baseUrl: '',
      route: undefined,
      params: { id: '42' },
    };
    const res: any = new EventEmitter();
    res.statusCode = status;
    res.status = (code: number) => {
      res.statusCode = code;
      return res;
    };
    res.json = (body: unknown) => {
      res.body = body;
      return res;
    };
    res.send = (body?: unknown) => {
      res.body = body;
      return res;
    };

    let index = 0;
    const next = () => {
      const fn = middleware[index++];
      if (fn) {
        fn(req, res, next);
        return;
      }
      req.route = { path: routePath };
      handler?.(req, res);
      res.emit('finish');
    };

    next();
    await new Promise((resolve) => setImmediate(resolve));
    return res;
  }

  return { app: app as any, request };
}

describe('express integration', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('records route metrics, traces, and route-handler log enrichment', async () => {
    captureStdout();
    const lens = createIntegrationLens();
    const { app, request } = createExpressHarness();
    new ExpressMetricsAdapter().register(app, lens.httpMetricsRecorder);
    new ExpressTracingAdapter().register(app, lens.httpTracingRecorder);

    const res = await request({
      path: '/users/42',
      routePath: '/users/:id',
      status: 201,
      headers: {
        traceparent: '00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01',
      },
      handler(req) {
        lens.logger.info('express handler', { id: req.params.id });
      },
    });
    await request({
      path: '/health',
      routePath: '/health',
      status: 204,
    });
    await lens.shutdown();

    expect(res.statusCode).toBe(201);
    expect(
      metricSample(lens, 'http_requests_total', {
        method: 'GET',
        route: '/users/:id',
        status: '201',
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
      'express handler',
    );
    expect(log).toMatchObject({
      message: 'express handler',
      traceId: '4bf92f3577b34da6a3ce929d0e0e4736',
    });
    expect(log.spanId).toEqual(expect.any(String));
  });

  it('marks failed responses as trace errors', async () => {
    captureStdout();
    const lens = createIntegrationLens();
    const { app, request } = createExpressHarness();
    new ExpressTracingAdapter().register(app, lens.httpTracingRecorder);

    await request({
      path: '/fail',
      routePath: '/fail',
      status: 503,
    });
    await lens.shutdown();

    expect(lens.getStats().traces.snapshot).toMatchObject({
      startedCount: 1,
      endedCount: 1,
      exportedCount: 1,
    });
  });
});
