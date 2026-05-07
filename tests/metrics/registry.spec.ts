import { MetricsRegistry } from '../../src/core/metrics/registry';

describe('metrics registry', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('records counters, gauges, and histograms with deterministic label ordering', () => {
    const registry = new MetricsRegistry({ maxSeriesPerMetric: 10 });

    registry.counter('requests_total', 'requests').inc(2, {
      route: '/users',
      method: 'GET',
    });
    registry.gauge('queue_depth', 'queue depth').set(5, {
      worker: 'a',
    });
    registry
      .histogram('request_duration_seconds', 'request duration', {
        buckets: [0.1, 0.5, 1],
      })
      .observe(0.2, { route: '/users' });

    expect(registry.snapshot().entries).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          name: 'requests_total',
          samples: [
            expect.objectContaining({
              encodedLabels: '',
              value: 0,
            }),
            expect.objectContaining({
              encodedLabels: 'method="GET",route="/users"',
              value: 2,
            }),
          ],
        }),
        expect.objectContaining({
          name: 'queue_depth',
          samples: expect.arrayContaining([
            expect.objectContaining({
              encodedLabels: 'worker="a"',
              value: 5,
            }),
          ]),
        }),
        expect.objectContaining({
          name: 'request_duration_seconds',
          samples: [
            expect.objectContaining({
              labels: { route: '/users' },
              value: {
                sum: 0.2,
                count: 1,
                buckets: [
                  { le: 0.1, value: 0 },
                  { le: 0.5, value: 1 },
                  { le: 1, value: 1 },
                ],
              },
            }),
          ],
        }),
      ]),
    );
  });

  it('bounds metric cardinality and returns no-op handles after the limit', () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
    const registry = new MetricsRegistry({ maxSeriesPerMetric: 2 });
    const counter = registry.counter('requests_total', 'requests');

    counter.inc(1, { route: '/users' });
    counter.inc(1, { route: '/orders' });
    counter.inc(1, { route: '/invoices' });

    const entry = registry
      .snapshot()
      .entries.find((item) => item.name === 'requests_total')!;

    expect(entry.samples.map((sample) => sample.labels)).toEqual([
      {},
      { route: '/users' },
    ]);
    expect(warn).toHaveBeenCalledWith(
      '[corelens] Cardinality limit reached for requests_total',
    );
  });

  it('rejects counter decrements and metric type collisions', () => {
    const registry = new MetricsRegistry({ maxSeriesPerMetric: 10 });

    expect(() => registry.counter('requests_total').inc(-1)).toThrow(
      'Counter cannot be incremented by a negative value',
    );
    registry.counter('shared_name');
    expect(() => registry.gauge('shared_name')).toThrow(
      'Metric collision: Name "shared_name" is already registered as a counter. Cannot re-register as a gauge.',
    );
  });

  it('escapes label values for prometheus output', () => {
    const registry = new MetricsRegistry({ maxSeriesPerMetric: 10 });

    registry.counter('requests_total').inc(1, {
      path: '/quoted/"value"\nline\\slash',
    });

    expect(registry.snapshot().entries[0].samples[1].encodedLabels).toBe(
      'path="/quoted/\\"value\\"\\nline\\\\slash"',
    );
  });
});
