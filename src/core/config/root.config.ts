import { CorelensConfig, NormalisedConfig } from './types';
import { nonEmptyString } from './primitives';
import { normaliseExportConfig } from './export.config';
import { normaliseLogConfig } from './logs.config';
import { normaliseMetricsConfig } from './metrics.config';
import { normaliseTracesConfig } from './traces.config';

export function normaliseCorelensConfig(cfg: CorelensConfig): NormalisedConfig {
  return {
    serviceName: nonEmptyString('serviceName', cfg.serviceName),
    logs: normaliseLogConfig(cfg.logs),
    metrics: normaliseMetricsConfig(cfg.metrics),
    traces: normaliseTracesConfig(cfg.traces),
    export: normaliseExportConfig(cfg.export),
    lifecycle: {
      handleProcessSignals: cfg.lifecycle?.handleProcessSignals ?? false,
    },
    diagnostics: {
      warnOnExportFailure: cfg.diagnostics?.warnOnExportFailure ?? true,
      warnOnConfigFallback: cfg.diagnostics?.warnOnConfigFallback ?? false,
    },
  };
}
