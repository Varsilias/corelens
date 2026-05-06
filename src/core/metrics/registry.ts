type MetricType = 'counter' | 'gauge' | 'histogram';

type Labels = Record<string, string>;

type StoredMetricValue = {
  labels: Labels;
  value: number;
};

export type MetricSample = {
  encodedLabels: string;
  labels: Labels;
  value: number | HistogramSample;
};

export type RegistryEntry = {
  name: string;
  help: string;
  type: MetricType;
  samples: MetricSample[];
};

export type MetricsSnapshot = {
  entries: RegistryEntry[];
};

export type HistogramSample = {
  sum: number;
  count: number;
  buckets: Array<{ le: number; value: number }>;
};

export type HistogramValue = {
  sum: number;
  count: number;
  bucketValues: number[];
  labels: Labels;
};
export interface IMetricsRegistry {
  gauge(name: string, help: string): Gauge;
  counter(name: string, help: string): Counter;
  histogram(
    name: string,
    help: string,
    config: { buckets: number[] },
  ): Histogram;
  snapshot(): MetricsSnapshot;
}

type RegistryConfig = {
  maxSeriesPerMetric: number;
};

export class MetricsRegistry implements IMetricsRegistry {
  private counters = new Map<string, Counter>();
  private gauges = new Map<string, Gauge>();
  private histograms = new Map<string, Histogram>();

  // A master set to track every name used, regardless of type
  private registeredNames = new Map<string, MetricType>();
  private readonly maxSeriesPerMetric: number;

  constructor(config: RegistryConfig) {
    this.maxSeriesPerMetric = config.maxSeriesPerMetric;
  }

  counter(name: string, help: string = '') {
    this.validateName(name, 'counter');

    let instance = this.counters.get(name);
    if (!instance) {
      instance = new Counter(name, help, this.maxSeriesPerMetric);
      this.counters.set(name, instance);
    }

    return instance;
  }
  gauge(name: string, help: string = '') {
    this.validateName(name, 'gauge');

    let instance = this.gauges.get(name);
    if (!instance) {
      instance = new Gauge(name, help, this.maxSeriesPerMetric);
      this.gauges.set(name, instance);
    }

    return instance;
  }

  histogram(
    name: string,
    help: string = '',
    config = { buckets: [0.1, 0.5, 1, 2, 5] },
  ) {
    this.validateName(name, 'histogram');

    let instance = this.histograms.get(name);
    if (!instance) {
      instance = new Histogram(name, help, this.maxSeriesPerMetric, config);
      this.histograms.set(name, instance);
    }
    return instance;
  }

  cardinalitySnapshot() {
    return {
      counters: this.getMapCardinality(this.counters),
      gauges: this.getMapCardinality(this.gauges),
      histograms: this.getMapCardinality(this.histograms),
      total: this.calculateTotalCardinality(),
    };
  }

  snapshot(): MetricsSnapshot {
    const entries: RegistryEntry[] = [];

    // Process Counters
    for (const counter of this.counters.values()) {
      entries.push({
        name: counter.name,
        help: counter.help,
        type: 'counter',
        samples: this.mapToSamples(counter.getValues()),
      });
    }

    // Process Gauges
    for (const gauge of this.gauges.values()) {
      entries.push({
        name: gauge.name,
        help: gauge.help,
        type: 'gauge',
        samples: this.mapToSamples(gauge.getValues()),
      });
    }

    // Process Histogram (neutral shape)
    for (const hist of this.histograms.values()) {
      const { buckets, data } = hist.getValues();

      entries.push({
        name: hist.name,
        help: hist.help,
        type: 'histogram',
        samples: data.map(([encodedLabels, state]) => ({
          encodedLabels,
          labels: state.labels,
          value: {
            sum: state.sum,
            count: state.count,
            buckets: buckets.map((le, index) => ({
              le,
              value: state.bucketValues[index],
            })),
          },
        })),
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

  /**
   * Helper to extract cardinality from a Map of metrics
   */
  private getMapCardinality(
    map: Map<string, Counter | Gauge | Histogram>,
  ): Record<string, number> {
    const stats: Record<string, number> = {};
    for (const [name, instance] of map.entries()) {
      stats[name] = instance.cardinality;
    }
    return stats;
  }

  /**
   * Sums up every single series across all metric types
   */
  private calculateTotalCardinality(): number {
    let total = 0;

    for (const c of this.counters.values()) total += c.cardinality;
    for (const g of this.gauges.values()) total += g.cardinality;
    for (const h of this.histograms.values()) total += h.cardinality;

    return total;
  }

  /**
   * Check name against list of registered names
   */
  private validateName(name: string, type: MetricType) {
    const existingType = this.registeredNames.get(name);

    if (existingType && existingType !== type) {
      throw new Error(
        `Metric collision: Name "${name}" is already registered as a ${existingType}. Cannot re-register as a ${type}.`,
      );
    }

    if (!existingType) {
      this.registeredNames.set(name, type);
    }
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

interface BoundHistogram {
  observe(value: number): void;
}

export class Counter {
  private values = new Map<string, StoredMetricValue>();
  private boundCache = new Map<string, BoundCounter>();

  constructor(
    public readonly name: string,
    public readonly help: string,
    private readonly limit: number,
  ) {
    this.inc(0);
  }

  get cardinality(): number {
    return this.values.size;
  }

  /**
   * Pre-binds labels to a counter.
   * Use this outside of hot loops for maximum performance.
   */
  labels(labels: Labels): BoundCounter {
    const key = serializeLabels(labels);

    let bound = this.boundCache.get(key);
    if (!bound) {
      if (!this.values.has(key) && this.cardinality >= this.limit) {
        console.warn(`[corelens] Cardinality limit reached for ${this.name}`);
        return { inc: () => {} };
      }
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

  constructor(
    public readonly name: string,
    public readonly help: string,
    private readonly limit: number,
  ) {
    this.inc(0);
  }

  get cardinality(): number {
    return this.values.size;
  }

  labels(labels: Labels): BoundGauge {
    const key = serializeLabels(labels);

    let bound = this.boundCache.get(key);
    if (!bound) {
      if (!this.values.has(key) && this.cardinality >= this.limit) {
        console.warn(`[corelens] Cardinality limit reached for ${this.name}`);
        return { inc: () => {}, dec: () => {}, set: () => {} };
      }

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
              value: -amount,
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

export class Histogram {
  private values = new Map<string, HistogramValue>();
  private boundCache = new Map<string, BoundHistogram>();
  private readonly sortedBuckets: number[];

  constructor(
    public readonly name: string,
    public readonly help: string,
    private readonly limit: number,
    private readonly config: { buckets: number[] },
  ) {
    // Ensure buckets are sorted for the binary search/loop logic
    this.sortedBuckets = [...this.config.buckets].sort((a, b) => a - b);
  }

  get cardinality(): number {
    return this.values.size;
  }

  labels(labels: Labels) {
    const key = serializeLabels(labels);
    let bound = this.boundCache.get(key);

    if (!bound) {
      if (!this.values.has(key) && this.cardinality >= this.limit) {
        console.warn(`[corelens] Cardinality limit reached for ${this.name}`);
        return { observe: () => {} };
      }

      const current = this.values.get(key);
      if (!current) {
        this.values.set(key, {
          sum: 0,
          count: 0,
          bucketValues: new Array(this.sortedBuckets.length).fill(0),
          labels,
        });
      }

      const state = this.values.get(key)!;
      bound = {
        observe: (value: number) => {
          state.sum += value;
          state.count++;

          // Increment all buckets where value <= bucket boundary
          // This is the "Cumulative" part of the histogram
          for (let i = 0; i < this.sortedBuckets.length; i++) {
            if (value <= this.sortedBuckets[i]) {
              state.bucketValues[i]++;
            }
          }
        },
      };
      this.boundCache.set(key, bound);
    }

    return bound;
  }

  observe(value: number, labels: Labels = {}) {
    this.labels(labels).observe(value);
  }

  getValues() {
    return {
      buckets: this.sortedBuckets,
      data: Array.from(this.values.entries()),
    };
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
    result += key + '="' + escapeLabelValue(labels[key]) + '"';
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
  gauge(name: string, help: string = ''): Gauge {
    return new Gauge(name, help, 1000);
  }
  counter(name: string, help: string = ''): Counter {
    return new Counter(name, help, 1000);
  }
  histogram(
    name: string,
    help: string = '',
    config: { buckets: number[] },
  ): Histogram {
    return new Histogram(name, help, 1000, config);
  }

  snapshot(): MetricsSnapshot {
    return {} as MetricsSnapshot;
  }
}
