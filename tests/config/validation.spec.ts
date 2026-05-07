import { normaliseCorelensConfig as normaliseConfig } from '../../src/core/config/root.config';

describe('config validation', () => {
  const base = {
    serviceName: 'api',
    export: { enabled: true, destination: { type: 'console' as const } },
  };

  it.each([
    [{ serviceName: '' }, 'serviceName must be a non-empty string'],
    [{ serviceName: '   ' }, 'serviceName must be a non-empty string'],
    [
      { serviceName: 'api', export: { destination: { type: 'console' } } },
      'export.enabled is required and must be a boolean',
    ],
    [
      {
        ...base,
        export: {
          enabled: true,
          mode: 'stream',
          destination: { type: 'console' as const },
        },
      },
      'export.mode must be one of: simple, batch',
    ],
    [
      {
        ...base,
        export: {
          enabled: true,
          destination: { type: 'console' as const },
          signals: { traces: { mode: 'simple' } },
        },
      },
      'export.signals.traces.enabled is required and must be a boolean',
    ],
    [
      {
        ...base,
        export: {
          enabled: true,
          destination: { type: 'console' as const },
          signals: { traces: { enabled: true, mode: 'stream' } },
        },
      },
      'export.signals.traces.mode must be one of: simple, batch',
    ],
    [
      { ...base, traces: { enabled: true, samplingRate: -0.01 } },
      'traces.samplingRate must be between 0 and 1',
    ],
    [
      { ...base, traces: { enabled: true, samplingRate: 1.01 } },
      'traces.samplingRate must be between 0 and 1',
    ],
    [
      { ...base, traces: { enabled: true, samplingRate: Number.NaN } },
      'traces.samplingRate must be a number',
    ],
    [
      { ...base, traces: { enabled: true, samplingRate: '0.5' } },
      'traces.samplingRate must be a number',
    ],
    [
      { ...base, logs: { enabled: true, maxQueueBytes: 1024 } },
      'logs.maxQueueBytes must be between',
    ],
    [
      { ...base, logs: { enabled: true, writer: { highWaterMark: 1024 } } },
      'logs.writer.highWaterMark must be between',
    ],
    [
      { ...base, logs: { enabled: true, format: 'text' } },
      'logs.format must be one of: json, pretty',
    ],
    [
      { ...base, logs: { enabled: true, level: 'trace' } },
      'logs.level must be one of: debug, info, warn, error',
    ],
    [
      { ...base, logs: { enabled: true, timestamp: { format: 'unix' } } },
      'logs.timestamp.format must be one of: epoch, iso',
    ],
    [
      { ...base, logs: { enabled: true, fullQueuePolicy: 'block' } },
      'logs.fullQueuePolicy must be one of: drop-newest, drop-oldest',
    ],
    [
      { ...base, metrics: { enabled: true, maxSeriesPerMetric: 0 } },
      'metrics.maxSeriesPerMetric must be between',
    ],
    [
      {
        ...base,
        metrics: {
          enabled: true,
          runtime: { enabled: true, intervalMs: 999 },
        },
      },
      'metrics.runtime.intervalMs must be between',
    ],
    [
      {
        ...base,
        metrics: { enabled: true, http: { enabled: true, buckets: [] } },
      },
      'metrics.http.buckets must be a non-empty array',
    ],
    [
      {
        ...base,
        metrics: {
          enabled: true,
          http: { enabled: true, buckets: { fast: 0.1 } },
        },
      },
      'metrics.http.buckets must be a non-empty array',
    ],
    [
      {
        ...base,
        metrics: {
          enabled: true,
          http: { enabled: true, buckets: [0.1, '0.5'] },
        },
      },
      'metrics.http.buckets[1] must be a positive finite number',
    ],
    [
      {
        ...base,
        metrics: {
          enabled: true,
          http: { enabled: true, buckets: [0.1, Number.POSITIVE_INFINITY] },
        },
      },
      'metrics.http.buckets[1] must be a positive finite number',
    ],
    [
      {
        ...base,
        metrics: {
          enabled: true,
          http: { enabled: true, buckets: [0.1, 0.1] },
        },
      },
      'metrics.http.buckets must be strictly increasing',
    ],
    [
      {
        ...base,
        export: {
          enabled: true,
          destination: { type: 'console' as const },
          batch: { fullQueuePolicy: 'block' },
        },
      },
      'export.batch.fullQueuePolicy must be one of: drop-newest, drop-oldest',
    ],
    [
      {
        ...base,
        export: {
          enabled: true,
          destination: { type: 'console' as const },
          batch: { maxQueueSize: 10, maxExportBatchSize: 11 },
        },
      },
      'export.batch.maxExportBatchSize must be between',
    ],
    [
      {
        ...base,
        export: {
          enabled: true,
          destination: { type: 'console' as const },
          batch: { scheduledDelayMs: 99 },
        },
      },
      'export.batch.scheduledDelayMs must be between',
    ],
    [
      {
        ...base,
        export: {
          enabled: true,
          destination: { type: 'console' as const },
          batch: { shutdownTimeoutMs: 99 },
        },
      },
      'export.batch.shutdownTimeoutMs must be between',
    ],
    [
      {
        ...base,
        export: {
          enabled: true,
          destination: { type: 'console' as const },
          retry: { maxRetries: 11 },
        },
      },
      'export.retry.maxRetries must be between',
    ],
    [
      {
        ...base,
        export: {
          enabled: true,
          destination: { type: 'console' as const },
          retry: { initialDelayMs: 1000, maxDelayMs: 999 },
        },
      },
      'export.retry.maxDelayMs must be between',
    ],
    [
      {
        ...base,
        export: {
          enabled: true,
          destination: { type: 'console' as const },
          circuitBreaker: { failureThreshold: 0 },
        },
      },
      'export.circuitBreaker.failureThreshold must be between',
    ],
    [
      {
        ...base,
        export: {
          enabled: true,
          destination: { type: 'console' as const },
          circuitBreaker: { resetTimeoutMs: 99 },
        },
      },
      'export.circuitBreaker.resetTimeoutMs must be between',
    ],
    [
      {
        ...base,
        export: {
          enabled: true,
          destination: { type: 'console' as const },
          signals: {
            traces: {
              enabled: true,
              batch: { fullQueuePolicy: 'block' },
            },
          },
        },
      },
      'export.signals.traces.batch.fullQueuePolicy must be one of: drop-newest, drop-oldest',
    ],
    [
      {
        ...base,
        export: {
          enabled: true,
          destination: { type: 'console' as const },
          signals: {
            traces: {
              enabled: true,
              batch: { maxQueueSize: 10, maxExportBatchSize: 11 },
            },
          },
        },
      },
      'export.signals.traces.batch.maxExportBatchSize must be between',
    ],
    [
      {
        ...base,
        export: {
          enabled: true,
          destination: { type: 'console' as const },
          signals: { metrics: { enabled: true, retry: { maxRetries: 11 } } },
        },
      },
      'export.signals.metrics.retry.maxRetries must be between',
    ],
    [
      {
        ...base,
        export: {
          enabled: true,
          destination: { type: 'console' as const },
          signals: {
            logs: {
              enabled: true,
              circuitBreaker: { resetTimeoutMs: 99 },
            },
          },
        },
      },
      'export.signals.logs.circuitBreaker.resetTimeoutMs must be between',
    ],
    [{ ...base, export: { enabled: true } }, 'export.destination is required'],
    [
      {
        ...base,
        export: {
          enabled: true,
          destination: { type: 'file' as const, filePath: '' },
        },
      },
      'export.destination.filePath must be a non-empty string',
    ],
    [
      {
        ...base,
        export: {
          enabled: true,
          destination: { type: 'otlp-http' as const, endpoint: 'not-a-url' },
        },
      },
      'export.destination.endpoint must be a valid URL',
    ],
    [
      {
        ...base,
        export: {
          enabled: true,
          destination: {
            type: 'otlp-http' as const,
            endpoint: 'http://collector:4318',
            headers: { authorization: 123 },
          },
        },
      },
      'export.destination.headers.authorization must be a string',
    ],
    [
      {
        ...base,
        export: {
          enabled: true,
          destination: {
            type: 'otlp-http' as const,
            endpoint: 'http://collector:4318/v1/traces',
          },
        },
      },
      'export.destination.endpoint should be a base URL',
    ],
    [
      {
        ...base,
        export: {
          enabled: true,
          destination: { type: 'file' as const, filePath: '/tmp/corelens.log' },
          signals: {
            logs: {
              enabled: true,
              destination: { type: 'file' as const, filePath: '' },
            },
          },
        },
      },
      'export.signals.logs.destination.filePath must be a non-empty string',
    ],
    [
      {
        ...base,
        export: {
          enabled: true,
          destination: { type: 'console' as const },
          signals: {
            traces: {
              enabled: true,
              destination: { type: 'otlp-http' as const, endpoint: 'bad-url' },
            },
          },
        },
      },
      'export.signals.traces.destination.endpoint must be a valid URL',
    ],
    [
      {
        ...base,
        export: {
          enabled: true,
          destination: {
            type: 'otlp-http' as const,
            endpoint: 'http://collector:4318',
          },
          signals: {
            traces: {
              enabled: true,
              destination: {
                type: 'otlp-http' as const,
                endpoint: 'http://traces:4318/v1/traces',
                headers: { authorization: 123 },
              },
            },
          },
        },
      },
      'export.signals.traces.destination.headers.authorization must be a string',
    ],
    [
      { ...base, export: { enabled: true, destination: { type: 'unknown' } } },
      'Unsupported export destination type',
    ],
  ])('fails fast for invalid config %#', (input, message) => {
    expect(() => normaliseConfig(input as any)).toThrow(message);
  });

  it.each([0, 0.5, 1])('accepts valid sampling rate %s', (samplingRate) => {
    expect(
      normaliseConfig({
        ...base,
        traces: { enabled: true, samplingRate },
      }).traces.samplingRate,
    ).toBe(samplingRate);
  });

  it('allows export to be omitted without requiring a destination', () => {
    expect(() => normaliseConfig({ serviceName: 'api' })).not.toThrow();
  });

  it('allows export disabled without requiring a destination', () => {
    expect(() =>
      normaliseConfig({
        serviceName: 'api',
        export: { enabled: false },
      }),
    ).not.toThrow();
  });
});
