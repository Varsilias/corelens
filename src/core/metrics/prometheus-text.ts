import { HistogramSample, MetricSample, MetricsSnapshot } from './registry';

export class PrometheusText {
  render(snapshot: MetricsSnapshot): string {
    let lines = '';
    for (const entry of snapshot.entries) {
      lines += `# HELP ${entry.name} ${entry.help}\n`;
      lines += `# TYPE ${entry.name} ${entry.type}\n`;

      for (const sample of entry.samples) {
        if (typeof sample.value === 'number') {
          lines += this.renderSample(
            entry.name,
            sample.encodedLabels,
            sample.value,
          );
        } else {
          lines += this.renderHistogram(entry.name, sample);
        }
      }
    }
    return lines;
  }

  private renderSample(
    name: string,
    encodedLabels: string,
    value: number,
  ): string {
    const labelStr = encodedLabels ? `{${encodedLabels}}` : '';
    return `${name}${labelStr} ${value}\n`;
  }

  private renderHistogram(name: string, sample: MetricSample): string {
    const hist = sample.value as HistogramSample;
    let lines = '';

    // 1. Render Buckets (le labels)
    for (const bucket of hist.buckets) {
      const labelsWithLe = this.joinLabels(
        sample.encodedLabels,
        `le="${bucket.le}"`,
      );
      lines += `${name}_bucket{${labelsWithLe}} ${bucket.value}\n`;
    }

    // 2. Render +Inf Bucket (Prometheus requirement)
    const infLabels = this.joinLabels(sample.encodedLabels, `le="+Inf"`);
    lines += `${name}_bucket{${infLabels}} ${hist.count}\n`;

    // 3. Render Sum and Count
    const baseLabels = sample.encodedLabels ? `{${sample.encodedLabels}}` : '';
    lines += `${name}_sum${baseLabels} ${hist.sum}\n`;
    lines += `${name}_count${baseLabels} ${hist.count}\n`;

    return lines;
  }

  private joinLabels(existing: string, extra: string): string {
    return existing ? `${existing},${extra}` : extra;
  }
}

export const promRenderer = new PrometheusText();
