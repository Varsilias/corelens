import { MetricsSnapshot } from '../core/registry';

export class PrometheusTextExporter {
  render(snapshot: MetricsSnapshot): string {
    let lines = '';
    for (const entry of snapshot.entries) {
      lines += `# HELP ${entry.name} ${entry.name}\n`;
      lines += `# TYPE ${entry.name} ${entry.type}\n`;

      for (const sample of entry.samples) {
        const labelStr = sample.encodedLabels
          ? `{${sample.encodedLabels}}`
          : '';
        lines += `${entry.name}${labelStr} ${sample.value}\n`;
      }
    }
    return lines;
  }
}
