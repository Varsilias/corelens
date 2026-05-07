import { MetricsExportScheduler } from '../../src/core/metrics/exporter-scheduler';
import { MetricsRegistry } from '../../src/core/metrics/registry';

function registryWithMetric() {
  const registry = new MetricsRegistry({ maxSeriesPerMetric: 10 });
  registry.counter('requests_total', 'requests').inc(2, { route: '/users' });
  return registry;
}

describe('metrics export scheduler', () => {
  it('uses an unref timer when started', async () => {
    const scheduler = new MetricsExportScheduler(
      registryWithMetric(),
      { export: jest.fn().mockResolvedValue(undefined) },
      { scheduledDelayMs: 60_000, shutdownTimeoutMs: 1_000 },
    );

    scheduler.start();

    expect((scheduler as any).timer.hasRef()).toBe(false);
    await scheduler.shutdown();
  });

  it('exports registry snapshots and records flush count', async () => {
    const exporter = { export: jest.fn().mockResolvedValue(undefined) };
    const scheduler = new MetricsExportScheduler(
      registryWithMetric(),
      exporter,
      {
        scheduledDelayMs: 60_000,
        shutdownTimeoutMs: 1_000,
      },
    );

    await scheduler.flush();

    expect(exporter.export).toHaveBeenCalledTimes(1);
    expect(exporter.export.mock.calls[0][0][0].entries).toHaveLength(1);
    expect(scheduler.snapshot()).toMatchObject({ flushCount: 1 });
  });

  it('shutdown is idempotent and delegates exporter shutdown once', async () => {
    const exporter = {
      export: jest.fn().mockResolvedValue(undefined),
      shutdown: jest.fn().mockResolvedValue(undefined),
    };
    const scheduler = new MetricsExportScheduler(
      registryWithMetric(),
      exporter,
      {
        scheduledDelayMs: 60_000,
        shutdownTimeoutMs: 1_000,
      },
    );

    scheduler.start();
    await scheduler.shutdown();
    await scheduler.shutdown();

    expect(exporter.shutdown).toHaveBeenCalledTimes(1);
  });

  it('records shutdown export failures without rejecting shutdown', async () => {
    const scheduler = new MetricsExportScheduler(
      registryWithMetric(),
      {
        export: jest.fn().mockRejectedValue(new Error('collector unavailable')),
        shutdown: jest.fn().mockResolvedValue(undefined),
      },
      {
        scheduledDelayMs: 60_000,
        shutdownTimeoutMs: 1_000,
        diagnostics: { warnOnExportFailure: false },
      },
    );

    await expect(scheduler.shutdown()).resolves.toBeUndefined();
    expect(scheduler.snapshot()).toMatchObject({
      failedExportCount: 1,
      lastExportError: 'collector unavailable',
    });
  });
});
