import { Gauge, IMetricsRegistry } from '../core';
import { performance } from 'node:perf_hooks';

type RuntimeMetricsCollectorConfig = {
  intervalMs: number;
};

export class RuntimeMetricsCollector {
  private intervalId: NodeJS.Timeout | null = null;

  private readonly heapUsed: Gauge;
  private readonly heapTotal: Gauge;
  private readonly rss: Gauge;
  private readonly external: Gauge;
  private readonly uptime: Gauge;
  private readonly loopLag: Gauge;

  constructor(
    private readonly registry: IMetricsRegistry,
    private readonly config: RuntimeMetricsCollectorConfig,
  ) {
    this.heapUsed = this.registry.gauge('process_heap_used_bytes');
    this.heapTotal = this.registry.gauge('process_heap_total_bytes');
    this.rss = this.registry.gauge('process_rss_bytes');
    this.external = this.registry.gauge('process_external_memory_bytes');
    this.uptime = this.registry.gauge('process_uptime_seconds');
    this.loopLag = this.registry.gauge('node_event_loop_lag_seconds');
  }

  start() {
    if (this.intervalId) return;

    this.collect();

    this.intervalId = setInterval(() => {
      this.collect();
    }, this.config.intervalMs);

    // Ensure the timer doesn't keep the process alive if everything else stops
    this.intervalId.unref();
  }

  stop() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }

  private collect() {
    const mem = process.memoryUsage();

    this.heapUsed.set(mem.heapUsed);
    this.heapTotal.set(mem.heapTotal);
    this.rss.set(mem.rss);
    this.external.set(mem.external);
    this.uptime.set(process.uptime());

    const start = performance.now();
    setImmediate(() => {
      const lagMs = performance.now() - start;
      this.loopLag.set(lagMs / 1000);
    });
  }
}
