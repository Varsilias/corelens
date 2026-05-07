import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { corelens } from '../../src';

describe('corelens self-observability stats', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('exposes logs, metrics, traces, queue, dropped, and export stats', async () => {
    jest.spyOn(process.stdout, 'write').mockImplementation(() => true);
    const lens = corelens({
      serviceName: 'api',
      logs: {
        enabled: true,
        maxQueueBytes: 64 * 1024,
        fullQueuePolicy: 'drop-newest',
        timestamp: { format: 'epoch' },
      },
      metrics: {
        enabled: true,
        runtime: { enabled: false },
        maxSeriesPerMetric: 10,
      },
      traces: {
        enabled: true,
        samplingRate: 1,
      },
      export: {
        enabled: true,
        destination: { type: 'console' },
        signals: {
          metrics: { enabled: true },
          traces: { enabled: true },
        },
      },
    });

    lens.logger.info('first');
    lens.logger.info('x'.repeat(70 * 1024));
    lens.metrics.counter('requests_total', 'requests').inc(1, {
      route: '/users',
    });
    lens.tracer.withSpan('operation', () => {});

    await lens.shutdown();
    const stats = lens.getStats();

    expect(stats.logs.primary).toMatchObject({
      producedCount: 2,
      droppedCount: 1,
      currentQueueLength: 0,
      queuedBytes: 0,
    });
    expect(stats.metrics.snapshot.entries.length).toBeGreaterThan(0);
    expect(stats.metrics.labelCardinalitySnapshot.total).toBeGreaterThan(0);
    expect(stats.metrics.export).toMatchObject({
      flushCount: expect.any(Number),
      failedExportCount: expect.any(Number),
    });
    expect(stats.traces.snapshot).toMatchObject({
      startedCount: 1,
      endedCount: 1,
      exportedCount: 1,
      currentQueueLength: 0,
      failedExportCount: 0,
    });
  });

  it('exposes the latest shutdown result and returns it from shutdown', async () => {
    jest.spyOn(process.stdout, 'write').mockImplementation(() => true);
    const lens = corelens({
      serviceName: 'api',
      logs: { enabled: true },
      metrics: { enabled: false },
      traces: { enabled: false },
    });

    lens.logger.info('before shutdown');

    const result = await lens.shutdown();

    expect(result).toMatchObject({
      completed: true,
      moduleCount: 1,
      errors: [],
      durationMs: expect.any(Number),
    });
    expect(lens.getStats().shutdown.lastResult).toEqual(result);
  });

  it('exposes log tee export stats through getStats', async () => {
    jest.spyOn(process.stdout, 'write').mockImplementation(() => true);
    const dir = await mkdtemp(join(tmpdir(), 'corelens-stats-'));
    const lens = corelens({
      serviceName: 'api',
      logs: { enabled: true },
      metrics: { enabled: false },
      traces: { enabled: false },
      export: {
        enabled: true,
        destination: { type: 'file', filePath: join(dir, 'logs.jsonl') },
        signals: {
          logs: { enabled: true },
        },
      },
    });

    try {
      lens.logger.info('exported log');
      await lens.shutdown();

      expect(lens.getStats().logs.tee).toMatchObject({
        exportedCount: 1,
        failedExportCount: 0,
        currentQueueLength: 0,
        flushCount: 1,
      });
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it('exposes failed export counts and last errors for metrics and traces', async () => {
    jest.spyOn(process.stdout, 'write').mockImplementation(() => true);
    jest.spyOn(globalThis, 'fetch').mockImplementation(() =>
      Promise.resolve(
        new Response('collector unavailable', {
          status: 503,
          statusText: 'Service Unavailable',
        }),
      ),
    );
    const lens = corelens({
      serviceName: 'api',
      logs: { enabled: false },
      metrics: {
        enabled: true,
        runtime: { enabled: false },
      },
      traces: {
        enabled: true,
        samplingRate: 1,
      },
      diagnostics: { warnOnExportFailure: false },
      export: {
        enabled: true,
        destination: {
          type: 'otlp-http',
          endpoint: 'http://collector:4318',
        },
        retry: { enabled: false },
        circuitBreaker: { enabled: false },
        signals: {
          metrics: { enabled: true },
          traces: { enabled: true },
        },
      },
    });

    lens.metrics.counter('requests_total', 'requests').inc();
    lens.tracer.withSpan('operation', () => {});

    await lens.shutdown();
    const stats = lens.getStats();

    expect(stats.metrics.export).toMatchObject({
      failedExportCount: 1,
      lastExportError:
        'OTLP HTTP export failed: 503 Service Unavailable collector unavailable',
    });
    expect(stats.traces.snapshot).toMatchObject({
      failedExportCount: 1,
      lastExportError:
        'OTLP HTTP export failed: 503 Service Unavailable collector unavailable',
      currentQueueLength: 1,
    });
  });
});
