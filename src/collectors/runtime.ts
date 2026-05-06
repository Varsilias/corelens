import { Gauge, IMetricsRegistry } from '../core';
import { monitorEventLoopDelay, IntervalHistogram } from 'node:perf_hooks';

type RuntimeMetricsCollectorConfig = {
  intervalMs: number;
};

export class RuntimeMetricsCollector {
  private intervalId: NodeJS.Timeout | null = null;
  private histogram: IntervalHistogram;

  private readonly heapUsed: Gauge;
  private readonly heapTotal: Gauge;
  private readonly rss: Gauge;
  private readonly external: Gauge;
  private readonly uptime: Gauge;
  private readonly loopLag: Gauge;
  private readonly loopLagP99: Gauge;

  constructor(
    private readonly registry: IMetricsRegistry,
    private readonly config: RuntimeMetricsCollectorConfig,
  ) {
    // Memory Metrics
    this.heapUsed = this.registry.gauge(
      'process_heap_used_bytes',
      'The amount of memory used by V8 for objects.',
    );
    this.heapTotal = this.registry.gauge(
      'process_heap_total_bytes',
      'Total size of the V8 heap including un-allocated space.',
    );
    this.rss = this.registry.gauge(
      'process_rss_bytes',
      'Resident Set Size: Total memory allocated for the process execution.',
    );
    this.external = this.registry.gauge(
      'process_external_memory_bytes',
      'Memory used by C++ objects bound to JavaScript objects managed by V8.',
    );

    // Health & Performance Metrics
    this.uptime = this.registry.gauge(
      'process_uptime_seconds',
      'Number of seconds the process has been running.',
    );

    this.histogram = monitorEventLoopDelay({ resolution: 10 });

    this.loopLag = this.registry.gauge(
      'node_event_loop_lag_seconds',
      'The mean delay in seconds between when a callback is scheduled and when it executes.',
    );

    this.loopLagP99 = this.registry.gauge(
      'node_event_loop_lag_p99_seconds',
      'The 99th percentile delay in seconds between when a callback is scheduled and when it executes.',
    );
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
    this.histogram.disable();
  }

  private update() {
    const p99Lag = this.histogram.percentile(99) / 1e9;
    this.loopLagP99.set(p99Lag);

    const meanLagSeconds = this.histogram.mean / 1e9;
    this.loopLag.set(meanLagSeconds);

    this.histogram.reset();
  }

  private collect() {
    this.histogram.enable();
    const mem = process.memoryUsage();

    this.heapUsed.set(mem.heapUsed);
    this.heapTotal.set(mem.heapTotal);
    this.rss.set(mem.rss);
    this.external.set(mem.external);
    this.uptime.set(process.uptime());

    this.update();
  }
}
