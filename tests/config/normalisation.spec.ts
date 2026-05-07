import { normaliseConfig } from '../../src/core/config/validator';

describe('config normalisation', () => {
  it('normalises minimal setup with local logging and disabled export defaults', () => {
    const config = normaliseConfig({ serviceName: 'api' });

    expect(config.serviceName).toBe('api');
    expect(config.logs.enabled).toBe(true);
    expect(config.metrics.enabled).toBe(false);
    expect(config.traces.enabled).toBe(false);
    expect(config.export.enabled).toBe(false);
    expect(config.export.destination).toEqual({
      type: 'console',
      pretty: false,
    });
    expect(config.export.signals.logs.enabled).toBe(false);
    expect(config.export.signals.metrics.enabled).toBe(false);
    expect(config.export.signals.traces.enabled).toBe(false);
  });

  it('normalises independent signal enablement without forcing other signals on', () => {
    const config = normaliseConfig({
      serviceName: 'api',
      logs: { enabled: false },
      metrics: { enabled: true },
      traces: { enabled: true, samplingRate: 0.25 },
      export: { enabled: false, destination: { type: 'console' } },
    });

    expect(config.logs.enabled).toBe(false);
    expect(config.metrics.enabled).toBe(true);
    expect(config.traces.enabled).toBe(true);
    expect(config.traces.samplingRate).toBe(0.25);
    expect(config.export.enabled).toBe(false);
  });

  it('normalises complete root defaults when export is enabled', () => {
    const config = normaliseConfig({
      serviceName: 'api',
      export: {
        enabled: true,
        destination: { type: 'console', pretty: true },
      },
    });

    expect(config.export.enabled).toBe(true);
    expect(config.export.mode).toBe('batch');
    expect(config.export.batch).toMatchObject({
      maxQueueSize: 2048,
      maxExportBatchSize: 512,
      scheduledDelayMs: 5000,
      shutdownTimeoutMs: 5000,
      fullQueuePolicy: 'drop-newest',
    });
    expect(config.export.retry).toMatchObject({
      enabled: true,
      maxRetries: 3,
      initialDelayMs: 100,
      maxDelayMs: 2000,
    });
    expect(config.export.circuitBreaker).toMatchObject({
      enabled: true,
      failureThreshold: 5,
      resetTimeoutMs: 30000,
    });
    expect(config.diagnostics.warnOnExportFailure).toBe(true);
    expect(config.lifecycle.handleProcessSignals).toBe(false);
  });

  it('resolves base OTLP endpoints per signal', () => {
    const config = normaliseConfig({
      serviceName: 'api',
      export: {
        enabled: true,
        destination: {
          type: 'otlp-http',
          endpoint: 'http://collector:4318/',
          headers: { authorization: 'Bearer token' },
          timeoutMs: 2500,
        },
      },
    });

    expect(config.export.destination).toMatchObject({
      type: 'otlp-http',
      endpoint: 'http://collector:4318',
      headers: { authorization: 'Bearer token' },
      timeoutMs: 2500,
      resolvedEndpoints: {
        traces: 'http://collector:4318/v1/traces',
        metrics: 'http://collector:4318/v1/metrics',
        logs: 'http://collector:4318/v1/logs',
      },
    });
  });
});
