import {
  ExportBatchConfig,
  ExportCircuitBreakerConfig,
  ExportRetryConfig,
  FullQueuePolicy,
  NormalisedExportBatchConfig,
  NormalisedExportCircuitBreakerConfig,
  NormalisedExportRetryConfig,
} from './types';
import { intInRange, oneOf } from './primitives';

const QUEUE_POLICIES: readonly FullQueuePolicy[] = [
  'drop-newest',
  'drop-oldest',
];

export function normaliseExportBatchConfig(
  cfg: ExportBatchConfig | undefined,
  field = 'export.batch',
): NormalisedExportBatchConfig {
  const maxQueueSize = intInRange(
    `${field}.maxQueueSize`,
    cfg?.maxQueueSize ?? 2048,
    1,
    1_000_000,
  );
  const maxExportBatchSize = intInRange(
    `${field}.maxExportBatchSize`,
    cfg?.maxExportBatchSize ?? 512,
    1,
    maxQueueSize,
  );

  return {
    maxQueueSize,
    maxExportBatchSize,
    scheduledDelayMs: intInRange(
      `${field}.scheduledDelayMs`,
      cfg?.scheduledDelayMs ?? 5_000,
      100,
      60_000,
    ),
    shutdownTimeoutMs: intInRange(
      `${field}.shutdownTimeoutMs`,
      cfg?.shutdownTimeoutMs ?? 5_000,
      100,
      30_000,
    ),
    fullQueuePolicy: oneOf(
      `${field}.fullQueuePolicy`,
      cfg?.fullQueuePolicy ?? 'drop-newest',
      QUEUE_POLICIES,
    ),
  };
}

export function normaliseExportRetryConfig(
  cfg: ExportRetryConfig | undefined,
  field = 'export.retry',
): NormalisedExportRetryConfig {
  const initialDelayMs = intInRange(
    `${field}.initialDelayMs`,
    cfg?.initialDelayMs ?? 100,
    1,
    60_000,
  );

  return {
    enabled: cfg?.enabled ?? true,
    maxRetries: intInRange(`${field}.maxRetries`, cfg?.maxRetries ?? 3, 0, 10),
    initialDelayMs,
    maxDelayMs: intInRange(
      `${field}.maxDelayMs`,
      cfg?.maxDelayMs ?? 2_000,
      initialDelayMs,
      300_000,
    ),
  };
}

export function normaliseExportCircuitBreakerConfig(
  cfg: ExportCircuitBreakerConfig | undefined,
  field = 'export.circuitBreaker',
): NormalisedExportCircuitBreakerConfig {
  return {
    enabled: cfg?.enabled ?? true,
    failureThreshold: intInRange(
      `${field}.failureThreshold`,
      cfg?.failureThreshold ?? 5,
      1,
      100,
    ),
    resetTimeoutMs: intInRange(
      `${field}.resetTimeoutMs`,
      cfg?.resetTimeoutMs ?? 30_000,
      100,
      300_000,
    ),
  };
}
