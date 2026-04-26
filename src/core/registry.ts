type MetricType = 'counter' | 'gauge' | 'histogram';

type Labels = Record<string, string>;

type StoredMetricValue = {
  labels: Labels;
  value: number;
};

type MetricSample = {
  encodedLabels: string;
  labels: Labels;
  value: number;
};

export type RegistryEntry = {
  name: string;
  type: MetricType;
  samples: MetricSample[];
};

export type MetricsSnapshot = {
  entries: RegistryEntry[];
};

export interface IMetricsRegistry {
  gauge(name: string): Gauge;
  counter(name: string): Counter;
  histogram(name: string): void;
  snapshot(): MetricsSnapshot;
}

export class MetricsRegistry implements IMetricsRegistry {
  private counters = new Map<string, Counter>();
  private gauges = new Map<string, Gauge>();

  counter(name: string) {
    let instance = this.counters.get(name);

    if (!instance) {
      instance = new Counter(name);
      this.counters.set(name, instance);
    }

    return instance;
  }
  gauge(name: string) {
    let instance = this.gauges.get(name);

    if (!instance) {
      instance = new Gauge(name);
      this.gauges.set(name, instance);
    }

    return instance;
  }
  histogram(name: string) {}

  snapshot(): MetricsSnapshot {
    const entries: RegistryEntry[] = [];

    // Process Counters
    for (const counter of this.counters.values()) {
      entries.push({
        name: counter.name,
        type: 'counter',
        samples: this.mapToSamples(counter.getValues()),
      });
    }

    // Process Gauges
    for (const gauge of this.gauges.values()) {
      entries.push({
        name: gauge.name,
        type: 'gauge',
        samples: this.mapToSamples(gauge.getValues()),
      });
    }

    return { entries };
  }

  /**
   * Helper to convert the internal Array<[string, number]>
   * into the MetricSample[] array format.
   */
  private mapToSamples(
    values: Array<[string, StoredMetricValue]>,
  ): MetricSample[] {
    return values.map(([encodedLabels, stored]) => ({
      encodedLabels,
      labels: stored.labels,
      value: stored.value,
    }));
  }
}

interface BoundCounter {
  inc(amount?: number): void;
}

interface BoundGauge {
  inc(amount?: number): void;
  dec(amount?: number): void;
  set(value: number): void;
}

export class Counter {
  private values = new Map<string, StoredMetricValue>();
  private boundCache = new Map<string, BoundCounter>();

  constructor(public readonly name: string) {
    this.inc(0);
  }

  /**
   * Pre-binds labels to a counter.
   * Use this outside of hot loops for maximum performance.
   */
  labels(labels: Labels): BoundCounter {
    const key = serializeLabels(labels);

    let bound = this.boundCache.get(key);
    if (!bound) {
      bound = {
        inc: (amount = 1) => {
          const current = this.values.get(key);
          if (!current) {
            this.values.set(key, {
              labels,
              value: amount,
            });
            return;
          }
          current.value += amount;
        },
      };
      this.boundCache.set(key, bound);
    }

    return bound;
  }

  inc(amount = 1, labels: Labels = {}) {
    if (amount < 0) {
      throw new Error('Counter cannot be incremented by a negative value');
    }
    this.labels(labels).inc(amount);
  }

  getValues(): Array<[string, StoredMetricValue]> {
    return Array.from(this.values.entries());
  }
}

export class Gauge {
  private values = new Map<string, StoredMetricValue>();
  private boundCache = new Map<string, BoundGauge>();

  constructor(public readonly name: string) {
    this.inc(0);
  }

  labels(labels: Labels): BoundGauge {
    const key = serializeLabels(labels);

    let bound = this.boundCache.get(key);
    if (!bound) {
      bound = {
        inc: (amount = 1) => {
          const current = this.values.get(key) ?? 0;
          if (!current) {
            this.values.set(key, {
              labels,
              value: amount,
            });
            return;
          }
          current.value += amount;
        },
        set: (value: number) => {
          this.values.set(key, { labels, value });
        },
        dec: (amount = 1) => {
          const current = this.values.get(key);
          if (!current) {
            this.values.set(key, {
              labels,
              value: amount,
            });
            return;
          }
          current.value -= amount;
        },
      };
      this.boundCache.set(key, bound);
    }

    return bound;
  }

  inc(amount = 1, labels: Labels = {}) {
    this.labels(labels).inc(amount);
  }

  set(value: number, labels: Labels = {}) {
    this.labels(labels).set!(value);
  }

  dec(amount = 1, labels: Labels = {}) {
    this.labels(labels).dec!(amount);
  }

  getValues(): Array<[string, StoredMetricValue]> {
    return Array.from(this.values.entries());
  }
}

function serializeLabels(labels: Labels): string {
  const keys = Object.keys(labels);
  const len = keys.length;
  if (len === 0) return '';

  // Sort keys to ensure deterministic output (Prometheus requirement)
  keys.sort();

  let result = '';
  for (let i = 0; i < len; i++) {
    const key = keys[i];
    result += key + '="' + labels[key] + '"';
    if (i < len - 1) {
      result += ',';
    }
  }
  return result;
}

/**
 * Escapes label values according to Prometheus requirements:
 * \ -> \\
 * " -> \"
 * \n -> \n
 */
function escapeLabelValue(val: string): string {
  return val.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, '\\n');
}

export class NoopMetricsRegistry implements IMetricsRegistry {
  gauge(name: string): Gauge {
    return new Gauge(name);
  }
  counter(name: string): Counter {
    return new Counter(name);
  }
  histogram(name: string): void {}
  snapshot(): MetricsSnapshot {
    return {} as MetricsSnapshot;
  }
}
