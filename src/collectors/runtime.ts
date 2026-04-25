import { MetricsRegistry } from '../core';

type RuntimeMetricsCollectorConfig = {
  intervalMs: number;
};

export class RuntimeMetricsCollector {
  constructor(
    private readonly registry: MetricsRegistry,
    private readonly config: RuntimeMetricsCollectorConfig,
  ) {}

  start() {}

  stop() {}
}
