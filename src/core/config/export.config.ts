import {
  CorelensConfig,
  ExportSignal,
  NormalisedExportConfig,
  NormalisedSignalExportConfig,
  SignalExportOverride,
} from './types';
import { oneOf, requiredBoolean } from './primitives';
import {
  normaliseExportBatchConfig,
  normaliseExportCircuitBreakerConfig,
  normaliseExportRetryConfig,
} from './export-policy.config';
import {
  normaliseExportDestination,
  normaliseSignalDestination,
} from './export-destination.config';

const EXPORT_MODES = ['simple', 'batch'] as const;

export function normaliseExportConfig(
  cfg: CorelensConfig['export'],
): NormalisedExportConfig {
  if (!cfg) return disabledExportConfig();

  const enabled = requiredBoolean('export.enabled', cfg.enabled);
  if (!enabled) return disabledExportConfig();

  if (!cfg.destination) {
    throw new Error('[Corelens] export.destination is required');
  }

  const mode = oneOf('export.mode', cfg.mode ?? 'batch', EXPORT_MODES);
  const batch = normaliseExportBatchConfig(cfg.batch);
  const retry = normaliseExportRetryConfig(cfg.retry);
  const circuitBreaker = normaliseExportCircuitBreakerConfig(
    cfg.circuitBreaker,
  );
  const destination = normaliseExportDestination(cfg.destination, cfg.signals);
  const baseSignal = {
    enabled: false,
    mode,
    destination,
    batch,
    retry,
    circuitBreaker,
  };

  return {
    enabled,
    mode,
    destination,
    batch,
    retry,
    circuitBreaker,
    signals: {
      logs: normaliseSignalExport('logs', baseSignal, cfg.signals?.logs),
      metrics: normaliseSignalExport(
        'metrics',
        baseSignal,
        cfg.signals?.metrics,
      ),
      traces: normaliseSignalExport('traces', baseSignal, cfg.signals?.traces),
    },
  };
}

function normaliseSignalExport(
  signal: ExportSignal,
  base: NormalisedSignalExportConfig,
  override: SignalExportOverride | undefined,
): NormalisedSignalExportConfig {
  return {
    enabled: override
      ? requiredBoolean(`export.signals.${signal}.enabled`, override.enabled)
      : base.enabled,
    mode: oneOf(
      `export.signals.${signal}.mode`,
      override?.mode ?? base.mode,
      EXPORT_MODES,
    ),
    destination: normaliseSignalDestination(
      base.destination,
      override?.destination,
      signal,
    ),
    batch: normaliseExportBatchConfig(
      { ...base.batch, ...override?.batch },
      `export.signals.${signal}.batch`,
    ),
    retry: normaliseExportRetryConfig(
      { ...base.retry, ...override?.retry },
      `export.signals.${signal}.retry`,
    ),
    circuitBreaker: normaliseExportCircuitBreakerConfig(
      { ...base.circuitBreaker, ...override?.circuitBreaker },
      `export.signals.${signal}.circuitBreaker`,
    ),
  };
}

function disabledExportConfig(): NormalisedExportConfig {
  const batch = normaliseExportBatchConfig(undefined);
  return {
    enabled: false,
    mode: 'batch',
    destination: { type: 'console', pretty: false },
    batch,
    retry: {
      enabled: false,
      maxRetries: 0,
      initialDelayMs: 100,
      maxDelayMs: 2_000,
    },
    circuitBreaker: {
      enabled: false,
      failureThreshold: 5,
      resetTimeoutMs: 30_000,
    },
    signals: {
      logs: { enabled: false } as NormalisedSignalExportConfig,
      metrics: { enabled: false } as NormalisedSignalExportConfig,
      traces: { enabled: false } as NormalisedSignalExportConfig,
    },
  };
}
