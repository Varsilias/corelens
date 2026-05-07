import {
  CorelensConfig,
  DEFAULT_HTTP_BUCKETS,
  NormalisedMetricsConfig,
} from './types';
import { intInRange, requiredBoolean } from './primitives';

export function normaliseMetricsConfig(
  cfg: CorelensConfig['metrics'],
): NormalisedMetricsConfig {
  return {
    enabled: cfg ? requiredBoolean('metrics.enabled', cfg.enabled) : false,
    maxSeriesPerMetric: normaliseMaxSeriesPerMetric(cfg?.maxSeriesPerMetric),
    runtime: {
      enabled: cfg?.runtime
        ? requiredBoolean('metrics.runtime.enabled', cfg.runtime.enabled)
        : false,
      intervalMs: normaliseRuntimeInterval(cfg?.runtime?.intervalMs),
    },
    http: {
      enabled: cfg?.http
        ? requiredBoolean('metrics.http.enabled', cfg.http.enabled)
        : false,
      buckets: normaliseHttpBuckets(cfg?.http?.buckets),
      ignoredRoutes: cfg?.http?.ignoredRoutes ?? ['/metrics', '/health'],
    },
  };
}

export function normaliseRuntimeInterval(value: unknown): number {
  return intInRange(
    'metrics.runtime.intervalMs',
    value ?? 15_000,
    1_000,
    300_000,
  );
}

export function normaliseMaxSeriesPerMetric(value: unknown): number {
  return intInRange('metrics.maxSeriesPerMetric', value ?? 1_000, 1, 1_000_000);
}

export function normaliseHttpBuckets(value: unknown): number[] {
  if (value === undefined) return DEFAULT_HTTP_BUCKETS;
  if (!Array.isArray(value) || value.length === 0) {
    throw new Error(
      '[Corelens] metrics.http.buckets must be a non-empty array',
    );
  }

  let previous = 0;
  return value.map((bucket, index) => {
    if (typeof bucket !== 'number' || !Number.isFinite(bucket) || bucket <= 0) {
      throw new Error(
        `[Corelens] metrics.http.buckets[${index}] must be a positive finite number`,
      );
    }
    if (bucket <= previous) {
      throw new Error(
        '[Corelens] metrics.http.buckets must be strictly increasing',
      );
    }
    previous = bucket;
    return bucket;
  });
}
