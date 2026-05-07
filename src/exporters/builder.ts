import {
  NormalisedExportCircuitBreakerConfig,
  NormalisedExportRetryConfig,
} from '../core/config/types';
import { CircuitBreakerExporter } from './circuit-breaker';
import { RetryingTraceExporter } from './retry';
import { Exporter } from './types';

export class ExporterBuilder<T extends Record<string, any>> {
  private exporter: Exporter<T>;

  private constructor(exporter: Exporter<T>) {
    this.exporter = exporter;
  }

  static from<T extends Record<string, any>>(exporter: Exporter<T>) {
    return new ExporterBuilder(exporter);
  }

  withRetry(config: NormalisedExportRetryConfig) {
    if (config.enabled === false) return this;
    const { enabled, ...cfg } = config;

    this.exporter = new RetryingTraceExporter(this.exporter, cfg);
    return this;
  }

  withCircuitBreaker(config: NormalisedExportCircuitBreakerConfig) {
    if (config.enabled === false) return this;
    const { enabled, ...cfg } = config;
    this.exporter = new CircuitBreakerExporter(this.exporter, {
      resetTimeoutMs: cfg.resetTimeoutMs,
      threshold: cfg.failureThreshold,
    });
    return this;
  }

  build() {
    return this.exporter;
  }
}
