import { MetricsSnapshot } from '../core/registry';

export class PrometheusTextExporter {
  render(snapshot: MetricsSnapshot): string {
    const lines: string[] = [];

    for (const counter of snapshot.counters) {
      lines.push(`# TYPE ${counter.name} counter`);
      lines.push(`${counter.name} ${counter.value}`);
    }

    for (const gauge of snapshot.gauges) {
      lines.push(`# TYPE ${gauge.name} gauge`);
      lines.push(`${gauge.name} ${gauge.value}`);
    }

    return lines.join('\n') + '\n';
  }
}
