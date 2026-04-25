type MetricType = 'counter' | 'gauge' | 'histogram';

type RegistryEntry = {
  name: string;
  type: MetricType;
  value: number;
  // We store multiple values because the same metric name
  // can have different label combinations (e.g. method="GET" vs method="POST")
  //   values: Map<string, MetricValue>;
  //   help: string;
};

export class MetricsRegistry {
  private counters = new Map<string, RegistryEntry>();
  private gauges = new Map<string, RegistryEntry>();

  counter(name: string) {
    let entry = this.counters.get(name);
    if (!entry) {
      entry = { name, type: 'counter', value: 0 };
      this.counters.set(name, entry);
    }

    return {
      inc: (amount = 1) => {
        entry.value += amount;
      },
    };
  }
  gauge(name: string) {
    let entry = this.gauges.get(name);
    if (!entry) {
      entry = { name, type: 'gauge', value: 0 };
      this.gauges.set(name, entry);
    }
    return {
      set: (value: number) => {
        entry.value = value;
      },
      inc: (amount = 1) => {
        entry.value += amount;
      },
      dec: (amount = 1) => {
        entry.value -= amount;
      },
    };
  }
  histogram(name: string) {}

  snapshot(): MetricsSnapshot {
    return {
      counters: [...this.counters.values()],
      gauges: [...this.gauges.values()],
    };
  }
}

export type MetricsSnapshot = {
  counters: RegistryEntry[];
  gauges: RegistryEntry[];
};
