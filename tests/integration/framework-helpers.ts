import { corelens } from '../../src';

export function createIntegrationLens() {
  return corelens({
    serviceName: 'api',
    logs: {
      enabled: true,
      timestamp: { format: 'epoch' },
      enrichWithTraceContext: true,
    },
    metrics: {
      enabled: true,
      runtime: { enabled: false },
      http: {
        enabled: true,
        ignoredRoutes: ['/health'],
      },
      maxSeriesPerMetric: 100,
    },
    traces: {
      enabled: true,
      samplingRate: 1,
      http: {
        enabled: true,
        ignoredRoutes: ['/health'],
      },
    },
    export: {
      enabled: false,
    },
  });
}

export function captureStdout() {
  const lines: string[] = [];
  const write = jest
    .spyOn(process.stdout, 'write')
    .mockImplementation((chunk: any) => {
      lines.push(String(chunk));
      return true;
    });

  return { lines, write };
}

export function parsedLog(lines: string[], message: string) {
  return lines
    .map((line) => {
      try {
        return JSON.parse(line);
      } catch {
        return undefined;
      }
    })
    .find((entry) => entry?.message === message);
}

export function metricSample(
  lens: ReturnType<typeof corelens>,
  metricName: string,
  labels: Record<string, string>,
) {
  const entry = lens
    .getMetricsSnapshot()
    .entries.find((candidate) => candidate.name === metricName);

  return entry?.samples.find((sample) => {
    return Object.entries(labels).every(
      ([key, value]) => sample.labels[key] === value,
    );
  });
}
