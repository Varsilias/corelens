import { RuntimeMetricsCollector } from '../../src/collectors/runtime';
import { MetricsRegistry } from '../../src/core/metrics/registry';

describe('runtime metrics collector', () => {
  it('uses an unref interval and clears it on stop', () => {
    const collector = new RuntimeMetricsCollector(
      new MetricsRegistry({ maxSeriesPerMetric: 20 }),
      { intervalMs: 60_000 },
    );

    collector.start();
    const interval = (collector as any).intervalId;

    expect(interval.hasRef()).toBe(false);

    collector.stop();

    expect((collector as any).intervalId).toBeNull();
  });

  it('is safe to start and stop repeatedly without creating duplicate intervals', () => {
    const collector = new RuntimeMetricsCollector(
      new MetricsRegistry({ maxSeriesPerMetric: 20 }),
      { intervalMs: 60_000 },
    );

    collector.start();
    const first = (collector as any).intervalId;
    collector.start();
    expect((collector as any).intervalId).toBe(first);

    collector.stop();
    collector.stop();

    expect((collector as any).intervalId).toBeNull();
  });
});
