import { CorelensConfig, NormalisedTracesConfig } from './types';
import { numberInRange, requiredBoolean } from './primitives';

export function normaliseTracesConfig(
  cfg: CorelensConfig['traces'],
): NormalisedTracesConfig {
  return {
    enabled: cfg ? requiredBoolean('traces.enabled', cfg.enabled) : false,
    samplingRate: normaliseSamplingRate(cfg?.samplingRate),
    http: {
      enabled: cfg?.http
        ? requiredBoolean('traces.http.enabled', cfg.http.enabled)
        : false,
      ignoredRoutes: cfg?.http?.ignoredRoutes ?? ['/metrics', '/health'],
    },
  };
}

export function normaliseSamplingRate(value: unknown): number {
  return numberInRange('traces.samplingRate', value ?? 1, 0, 1);
}
