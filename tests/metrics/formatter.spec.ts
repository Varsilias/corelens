import { MetricsOtlpFormatter } from '../../src/core/metrics/formatter';
import { promRenderer } from '../../src/core/metrics/prometheus-text';
import { MetricsRegistry } from '../../src/core/metrics/registry';

describe('metrics formatters', () => {
  beforeEach(() => {
    jest.spyOn(Date, 'now').mockReturnValue(1_700_000_000_000);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('renders prometheus counters and histograms with +Inf buckets', () => {
    const registry = new MetricsRegistry({ maxSeriesPerMetric: 10 });
    registry.counter('requests_total', 'requests').inc(3, { route: '/users' });
    registry
      .histogram('request_duration_seconds', 'duration', {
        buckets: [0.1, 0.5],
      })
      .observe(0.2, { route: '/users' });

    expect(promRenderer.render(registry.snapshot())).toContain(
      'requests_total{route="/users"} 3\n',
    );
    expect(promRenderer.render(registry.snapshot())).toContain(
      'request_duration_seconds_bucket{route="/users",le="+Inf"} 1\n',
    );
  });

  it('formats counters, gauges, and histograms as OTLP metrics', () => {
    const registry = new MetricsRegistry({ maxSeriesPerMetric: 10 });
    registry.counter('requests_total', 'requests').inc(3, { route: '/users' });
    registry.gauge('queue_depth', 'depth').set(7, { queue: 'default' });
    registry
      .histogram('request_duration_seconds', 'duration', {
        buckets: [0.1, 0.5],
      })
      .observe(0.2, { route: '/users' });

    const formatted = new MetricsOtlpFormatter({
      serviceName: 'api',
      version: '1.0.0',
    }).format([registry.snapshot()]);
    const metrics = formatted.resourceMetrics[0].scopeMetrics[0].metrics;

    expect(formatted.resourceMetrics[0].resource.attributes).toContainEqual({
      key: 'service.name',
      value: { stringValue: 'api' },
    });
    expect(
      metrics.find((metric) => metric.name === 'requests_total')?.sum,
    ).toMatchObject({
      isMonotonic: true,
      aggregationTemporality: 2,
      dataPoints: expect.arrayContaining([
        expect.objectContaining({
          asDouble: 3,
          timeUnixNano: '1700000000000000000',
        }),
      ]),
    });
    expect(
      metrics.find((metric) => metric.name === 'queue_depth')?.gauge,
    ).toMatchObject({
      dataPoints: expect.arrayContaining([
        expect.objectContaining({
          asDouble: 7,
          attributes: [{ key: 'queue', value: { stringValue: 'default' } }],
        }),
      ]),
    });
    expect(
      metrics.find((metric) => metric.name === 'request_duration_seconds')
        ?.histogram,
    ).toMatchObject({
      aggregationTemporality: 2,
      dataPoints: [
        expect.objectContaining({
          count: '1',
          sum: 0.2,
          bucketCounts: ['0', '1', '1'],
          explicitBounds: [0.1, 0.5],
        }),
      ],
    });
  });
});
