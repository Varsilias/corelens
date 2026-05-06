import {
  labelsToAttributes,
  OTLPMetric,
  OTLPMetricsRequest,
} from '../../otlp/types';
import { SignalFormatter } from '../config';
import { MetricsSnapshot, RegistryEntry, HistogramSample } from './registry';
import { promRenderer } from './prometheus-text';

export class MetricsConsoleFormatter implements SignalFormatter<
  MetricsSnapshot,
  string
> {
  format(snapshot: MetricsSnapshot): string {
    return promRenderer.render(snapshot);
  }
}

export class MetricsFileFormatter implements SignalFormatter<
  MetricsSnapshot,
  string
> {
  format(snapshot: MetricsSnapshot): string {
    return promRenderer.render(snapshot);
  }
}

export class MetricsOtlpFormatter implements SignalFormatter<
  MetricsSnapshot,
  OTLPMetricsRequest
> {
  constructor(
    private readonly config: {
      serviceName: string;
      version: string;
    },
  ) {}
  format(snapshot: MetricsSnapshot): OTLPMetricsRequest {
    const nowNano = (BigInt(Date.now()) * 1_000_000n).toString();

    return {
      resourceMetrics: [
        {
          resource: {
            attributes: [
              {
                key: 'service.name',
                value: { stringValue: this.config.serviceName },
              },
            ],
          },
          scopeMetrics: [
            {
              scope: { name: 'corelens', version: this.config.version },
              metrics: snapshot.entries.map((entry) =>
                this.formatEntry(entry, nowNano),
              ),
            },
          ],
        },
      ],
    };
  }

  private formatEntry(entry: RegistryEntry, timeUnixNano: string): OTLPMetric {
    switch (entry.type) {
      case 'counter':
        return this.formatCounter(entry, timeUnixNano);
      case 'gauge':
        return this.formatGauge(entry, timeUnixNano);
      case 'histogram':
        return this.formatHistogram(entry, timeUnixNano);
    }
  }

  private formatCounter(
    entry: RegistryEntry,
    timeUnixNano: string,
  ): OTLPMetric {
    return {
      name: entry.name,
      description: entry.help,
      unit: '1',
      sum: {
        // AGGREGATION_TEMPORALITY_CUMULATIVE = 2
        // Counters only go up — isMonotonic signals that to the collector
        aggregationTemporality: 2,
        isMonotonic: true,
        dataPoints: entry.samples.map((s) => ({
          attributes: labelsToAttributes(s.labels),
          asDouble: s.value as number,
          timeUnixNano,
          // startTimeUnixNano: (optional but I need to consider this)
        })),
      },
    };
  }

  private formatGauge(entry: RegistryEntry, timeUnixNano: string): OTLPMetric {
    return {
      name: entry.name,
      description: entry.help,
      unit: '1',
      gauge: {
        dataPoints: entry.samples.map((s) => ({
          attributes: labelsToAttributes(s.labels),
          asDouble: s.value as number,
          timeUnixNano,
        })),
      },
    };
  }

  private formatHistogram(
    entry: RegistryEntry,
    timeUnixNano: string,
  ): OTLPMetric {
    return {
      name: entry.name,
      description: entry.help,
      unit: 'ms', // caller should override if unit varies
      histogram: {
        aggregationTemporality: 2,
        dataPoints: entry.samples.map((s) => {
          const h = s.value as HistogramSample;
          return {
            attributes: labelsToAttributes(s.labels),
            timeUnixNano,
            // startTimeUnixNano: (optional but I need to consider this)
            // "min": 0,
            // max: 2,
            count: h.count.toString(),
            sum: h.sum,
            // bucketCounts must include the overflow (+Inf) bucket at the end
            bucketCounts: [
              ...h.buckets.map((b) => b.value.toString()),
              h.count.toString(),
            ],
            explicitBounds: h.buckets.map((b) => b.le),
          };
        }),
      },
    };
  }
}
