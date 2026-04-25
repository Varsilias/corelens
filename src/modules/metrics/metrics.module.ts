import { Module } from '../../core/modules';
import { ModuleContext } from '../../core/context';
import { MetricsRegistry } from '../../core';
import { RuntimeMetricsCollector } from '../../collectors/runtime';

export class MetricsModule implements Module {
  private registry = new MetricsRegistry();
  private runtimeCollector?: RuntimeMetricsCollector;

  constructor(private ctx: ModuleContext) {
    const { config } = this.ctx;
    if (config.metrics.runtime.enabled) {
      this.runtimeCollector = new RuntimeMetricsCollector(this.registry, {
        intervalMs: ctx.config.metrics.runtime.intervalMs,
      });
    }
  }

  getRegistry() {
    return this.registry;
  }

  snapshot() {
    return this.registry.snapshot();
  }

  init(): void {}
  start(): void {
    this.runtimeCollector?.start();
  }
  async stop(): Promise<void> {
    this.runtimeCollector?.stop();
  }
}
