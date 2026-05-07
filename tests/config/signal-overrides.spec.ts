import { normaliseConfig } from '../../src/core/config/validator';

describe('signal export overrides', () => {
  it('inherits base export config for every signal by default', () => {
    const config = normaliseConfig({
      serviceName: 'api',
      export: {
        enabled: true,
        mode: 'batch',
        destination: { type: 'file', filePath: '/tmp/corelens.log' },
        batch: {
          maxQueueSize: 100,
          maxExportBatchSize: 20,
          scheduledDelayMs: 1000,
          shutdownTimeoutMs: 2000,
          fullQueuePolicy: 'drop-oldest',
        },
        retry: {
          enabled: true,
          maxRetries: 4,
          initialDelayMs: 50,
          maxDelayMs: 500,
        },
        circuitBreaker: {
          enabled: true,
          failureThreshold: 3,
          resetTimeoutMs: 4000,
        },
      },
    });

    for (const signal of ['logs', 'metrics', 'traces'] as const) {
      expect(config.export.signals[signal]).toMatchObject({
        enabled: false,
        mode: 'batch',
        destination: { type: 'file', filePath: '/tmp/corelens.log' },
        batch: config.export.batch,
        retry: config.export.retry,
        circuitBreaker: config.export.circuitBreaker,
      });
    }
  });

  it('applies signal-level enablement and mode without affecting other signals', () => {
    const config = normaliseConfig({
      serviceName: 'api',
      export: {
        enabled: true,
        destination: { type: 'console' },
        signals: {
          logs: { enabled: false },
          traces: { enabled: true, mode: 'simple' },
        },
      },
    });

    expect(config.export.signals.logs.enabled).toBe(false);
    expect(config.export.signals.metrics.enabled).toBe(false);
    expect(config.export.signals.traces.enabled).toBe(true);
    expect(config.export.signals.traces.mode).toBe('simple');
    expect(config.export.signals.metrics.mode).toBe('batch');
  });

  it('deep-merges partial signal retry, circuit breaker, and batch overrides', () => {
    const config = normaliseConfig({
      serviceName: 'api',
      export: {
        enabled: true,
        destination: { type: 'console' },
        batch: {
          maxQueueSize: 100,
          maxExportBatchSize: 25,
          scheduledDelayMs: 1000,
          shutdownTimeoutMs: 3000,
          fullQueuePolicy: 'drop-newest',
        },
        retry: {
          enabled: true,
          maxRetries: 5,
          initialDelayMs: 100,
          maxDelayMs: 1000,
        },
        circuitBreaker: {
          enabled: true,
          failureThreshold: 4,
          resetTimeoutMs: 5000,
        },
        signals: {
          traces: {
            enabled: true,
            batch: { maxExportBatchSize: 10 },
            retry: { enabled: false },
            circuitBreaker: { failureThreshold: 2 },
          },
        },
      },
    });

    expect(config.export.signals.traces.batch).toEqual({
      maxQueueSize: 100,
      maxExportBatchSize: 10,
      scheduledDelayMs: 1000,
      shutdownTimeoutMs: 3000,
      fullQueuePolicy: 'drop-newest',
    });
    expect(config.export.signals.traces.retry).toEqual({
      enabled: false,
      maxRetries: 5,
      initialDelayMs: 100,
      maxDelayMs: 1000,
    });
    expect(config.export.signals.traces.circuitBreaker).toEqual({
      enabled: true,
      failureThreshold: 2,
      resetTimeoutMs: 5000,
    });
    expect(config.export.signals.metrics.batch).toEqual(config.export.batch);
    expect(config.export.signals.logs.retry).toEqual(config.export.retry);
  });

  it('resolves signal-specific OTLP endpoints and keeps inherited defaults', () => {
    const config = normaliseConfig({
      serviceName: 'api',
      export: {
        enabled: true,
        destination: {
          type: 'otlp-http',
          endpoint: 'http://collector:4318',
          headers: { root: 'yes' },
          timeoutMs: 3000,
        },
        signals: {
          traces: {
            enabled: true,
            destination: {
              type: 'otlp-http',
              endpoint: 'http://trace-collector:4318/custom/traces',
            },
          },
        },
      },
    });

    expect(config.export.signals.traces.destination).toMatchObject({
      type: 'otlp-http',
      endpoint: 'http://trace-collector:4318/custom/traces',
      headers: { root: 'yes' },
      timeoutMs: 3000,
      resolvedEndpoints: {
        traces: 'http://trace-collector:4318/custom/traces',
        metrics: 'http://collector:4318/v1/metrics',
        logs: 'http://collector:4318/v1/logs',
      },
    });
    expect(config.export.signals.metrics.destination).toMatchObject({
      type: 'otlp-http',
      resolvedEndpoints: {
        metrics: 'http://collector:4318/v1/metrics',
      },
    });
  });
});
