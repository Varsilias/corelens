import { ExporterBuilder } from '../../src/exporters/builder';
import { CircuitBreakerExporter } from '../../src/exporters/circuit-breaker';
import { RetryingTraceExporter } from '../../src/exporters/retry';

describe('exporter builder', () => {
  it('returns the original exporter when retry and circuit breaker are disabled', () => {
    const exporter = { export: jest.fn().mockResolvedValue(undefined) };

    const built = ExporterBuilder.from(exporter)
      .withRetry({
        enabled: false,
        maxRetries: 3,
        initialDelayMs: 1,
        maxDelayMs: 10,
      })
      .withCircuitBreaker({
        enabled: false,
        failureThreshold: 2,
        resetTimeoutMs: 100,
      })
      .build();

    expect(built).toBe(exporter);
  });

  it('wraps retry before circuit breaker when both are enabled', () => {
    const exporter = { export: jest.fn().mockResolvedValue(undefined) };

    const built = ExporterBuilder.from(exporter)
      .withRetry({
        enabled: true,
        maxRetries: 3,
        initialDelayMs: 1,
        maxDelayMs: 10,
      })
      .withCircuitBreaker({
        enabled: true,
        failureThreshold: 2,
        resetTimeoutMs: 100,
      })
      .build();

    expect(built).toBeInstanceOf(CircuitBreakerExporter);
    expect((built as any).inner).toBeInstanceOf(RetryingTraceExporter);
    expect((built as any).inner.inner).toBe(exporter);
  });
});
