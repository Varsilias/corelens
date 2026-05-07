import { normaliseConfig } from '../../src/core/config/validator';

describe('config validation', () => {
  const base = {
    serviceName: 'api',
    export: { enabled: true, destination: { type: 'console' as const } },
  };

  it.each([
    [{ serviceName: '' }, 'serviceName is required'],
    [{ serviceName: '   ' }, 'serviceName is required'],
    [
      { serviceName: 'api', export: { destination: { type: 'console' } } },
      'export.enabled is required and must be a boolean',
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
      { ...base, logs: { enabled: true, maxQueueBytes: 1024 } },
      'logs.maxQueueBytes must be between',
    ],
    [
      { ...base, logs: { enabled: true, writer: { highWaterMark: 1024 } } },
      'logs.writer.highWaterMark must be between',
    ],
    [
      { ...base, metrics: { enabled: true, maxSeriesPerMetric: 0 } },
      'metrics.maxSeriesPerMetric must be between',
    ],
    [
      { ...base, metrics: { enabled: true, runtime: { intervalMs: 999 } } },
      'metrics.runtime.intervalMs must be between',
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
            endpoint: 'http://collector:4318/v1/traces',
          },
        },
      },
      'export.destination.endpoint should be a base URL',
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
        export: { enabled: false } as any,
      }),
    ).not.toThrow();
  });
});
