import {
  CorelensConfig,
  DEFAULT_MAX_QUEUE_SIZE,
  DEFAULT_STREAM_HIGHWATERMARK,
  ExportDestination,
  NormalisedConfig,
  NormalisedExportBatchConfig,
  NormalisedExportConfig,
  NormalisedExportDestination,
  NormalisedLogConfig,
  NormalisedMetricsConfig,
  NormalisedSignalExportConfig,
  NormalisedTracesConfig,
  DEFAULT_HTTP_BUCKETS,
  ExportSignal,
  OtlpHttpExportDestination,
  NormalisedOtlpHttpExportDestination,
  ExportSignalOverrides,
} from '.';

// ─────────────────────────────────────────────────────────────────────────────
// Primitive guards
// These are the building blocks used by all domain validators below.
// They throw on invalid input and return the coerced value on success,
// so callers can inline them without a separate assertion step.
// ─────────────────────────────────────────────────────────────────────────────

function assertPositiveInt(name: string, value: unknown): number {
  if (!Number.isInteger(value) || Number(value) <= 0) {
    throw new Error(`[Corelens] ${name} must be a positive integer`);
  }
  return Number(value);
}

function assertIntInRange(
  name: string,
  value: unknown,
  min: number,
  max: number,
): number {
  if (!Number.isInteger(value)) {
    throw new Error(`[Corelens] ${name} must be an integer`);
  }
  const n = Number(value);
  if (n < min || n > max) {
    throw new Error(`[Corelens] ${name} must be between ${min} and ${max}`);
  }
  return n;
}

function assertNumberInRange(
  name: string,
  value: unknown,
  min: number,
  max: number,
): number {
  if (typeof value !== 'number' || Number.isNaN(value)) {
    throw new Error(`[Corelens] ${name} must be a number`);
  }
  if (value < min || value > max) {
    throw new Error(`[Corelens] ${name} must be between ${min} and ${max}`);
  }
  return value;
}

function assertNonEmptyString(name: string, value: unknown): string {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new Error(`[Corelens] ${name} must be a non-empty string`);
  }
  return value;
}

// ─────────────────────────────────────────────────────────────────────────────
// Logs validators
// Rule: logs.maxQueueBytes        >= 64KB, <= 512MB
// Rule: logs.writer.highWaterMark >= 16KB, <= 16MB
// ─────────────────────────────────────────────────────────────────────────────

export function normaliseHighWaterMark(value: unknown): number {
  return assertIntInRange(
    'logs.writer.highWaterMark',
    value ?? DEFAULT_STREAM_HIGHWATERMARK,
    16 * 1024, // 16KB minimum — Node's own default
    16 * 1024 * 1024, // 16MB maximum — beyond this, buffering harms latency
  );
}

export function normaliseMaxQueueBytes(value: unknown): number {
  return assertIntInRange(
    'logs.maxQueueBytes',
    value ?? DEFAULT_MAX_QUEUE_SIZE,
    64 * 1024, // 64KB minimum — anything smaller loses buffering value
    512 * 1024 * 1024, // 512MB maximum — hard ceiling to prevent OOM
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Metrics validators
// Rule: metrics.runtime.intervalMs  >= 1000ms, <= 300_000ms
// Rule: metrics.maxSeriesPerMetric  1 - 1_000_000
// ─────────────────────────────────────────────────────────────────────────────

export function normaliseRuntimeInterval(value: unknown): number {
  return assertIntInRange(
    'metrics.runtime.intervalMs',
    value ?? 15_000,
    1_000, // below 1s creates excessive overhead for runtime metrics
    300_000, // 5-minute ceiling — longer intervals should use a dedicated metrics system
  );
}

export function normaliseMaxSeriesPerMetric(value: unknown): number {
  return assertIntInRange(
    'metrics.maxSeriesPerMetric',
    value ?? 1_000,
    1,
    1_000_000,
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Traces validators
// Rule: traces.samplingRate  0 - 1 (float)
// ─────────────────────────────────────────────────────────────────────────────

export function normaliseSamplingRate(value: unknown): number {
  return assertNumberInRange('traces.samplingRate', value ?? 1, 0, 1);
}

// ─────────────────────────────────────────────────────────────────────────────
// Export — batch validators
// Rule: export.batch.maxQueueSize       1 - 1_000_000
// Rule: export.batch.maxExportBatchSize 1 - maxQueueSize  (cross-field)
// Rule: export.batch.scheduledDelayMs   100 - 60_000
// Rule: export.batch.shutdownTimeoutMs  100 - 30_000
// ─────────────────────────────────────────────────────────────────────────────

export function normaliseMaxQueueSize(value: unknown): number {
  return assertIntInRange(
    'export.batch.maxQueueSize',
    value ?? 2048,
    1,
    1_000_000,
  );
}

export function normaliseScheduledDelayMs(value: unknown): number {
  return assertIntInRange(
    'export.batch.scheduledDelayMs',
    value ?? 5_000,
    100,
    60_000,
  );
}

export function normaliseShutdownTimeoutMs(value: unknown): number {
  return assertIntInRange(
    'export.batch.shutdownTimeoutMs',
    value ?? 5_000,
    100,
    30_000,
  );
}

/**
 * Must be called after maxQueueSize is resolved.
 * maxExportBatchSize is validated against the already-normalised maxQueueSize
 * to catch the cross-field constraint in one place.
 */
export function normaliseMaxExportBatchSize(
  value: unknown,
  maxQueueSize: number,
): number {
  const batchSize = assertIntInRange(
    'export.batch.maxExportBatchSize',
    value ?? 512,
    1,
    maxQueueSize,
  );

  // Redundant after assertIntInRange but kept as an explicit cross-field guard
  // so the intent is obvious when reading this file in isolation.
  if (batchSize > maxQueueSize) {
    throw new Error(
      '[Corelens] export.batch.maxExportBatchSize cannot exceed export.batch.maxQueueSize',
    );
  }

  return batchSize;
}

/**
 * Validates the full batch config after all individual fields are resolved.
 * Use this as a final consistency check after normalisation.
 */
export function validateBatchConfig(batch: NormalisedExportBatchConfig): void {
  if (batch.maxExportBatchSize > batch.maxQueueSize) {
    throw new Error(
      '[Corelens] export.batch.maxExportBatchSize cannot be greater than export.batch.maxQueueSize',
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Export — retry validators
// Rule: export.retry.maxRetries      0 - 10
// Rule: export.retry.initialDelayMs  1 - 60_000
// Rule: export.retry.maxDelayMs      initialDelayMs - 300_000  (cross-field)
// ─────────────────────────────────────────────────────────────────────────────

export function normaliseMaxRetries(value: unknown): number {
  return assertIntInRange('export.retry.maxRetries', value ?? 3, 0, 10);
}

export function normaliseRetryInitialDelayMs(value: unknown): number {
  return assertIntInRange(
    'export.retry.initialDelayMs',
    value ?? 100,
    1,
    60_000,
  );
}

/**
 * Must be called after initialDelayMs is resolved.
 * maxDelayMs must be >= initialDelayMs to keep exponential backoff meaningful.
 */
export function normaliseRetryMaxDelayMs(
  value: unknown,
  initialDelayMs: number,
): number {
  const maxDelay = assertIntInRange(
    'export.retry.maxDelayMs',
    value ?? 2_000,
    initialDelayMs, // floor is the resolved initialDelayMs, not a hardcoded constant
    300_000,
  );
  return maxDelay;
}

// ─────────────────────────────────────────────────────────────────────────────
// Export — circuit breaker validators
// Rule: export.circuitBreaker.failureThreshold  1 - 100
// Rule: export.circuitBreaker.resetTimeoutMs    100 - 300_000
// ─────────────────────────────────────────────────────────────────────────────

export function normaliseFailureThreshold(value: unknown): number {
  return assertIntInRange(
    'export.circuitBreaker.failureThreshold',
    value ?? 5,
    1,
    100,
  );
}

export function normaliseCircuitBreakerResetTimeoutMs(value: unknown): number {
  return assertIntInRange(
    'export.circuitBreaker.resetTimeoutMs',
    value ?? 30_000,
    100,
    300_000,
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Export — destination validators
// Rule: destination.file.filePath       non-empty string
// Rule: destination.otlp-http.endpoint  valid URL
// Rule: destination.otlp-http.timeoutMs 100 - 60_000
// ─────────────────────────────────────────────────────────────────────────────

export function normaliseOtlpTimeoutMs(value: unknown): number {
  return assertIntInRange(
    'export.destination.timeoutMs',
    value ?? 3_000,
    100,
    60_000,
  );
}

export function validateDestination(destination: ExportDestination): void {
  switch (destination.type) {
    case 'console':
      return;

    case 'file':
      assertNonEmptyString('export.destination.filePath', destination.filePath);
      return;

    case 'otlp-http':
      assertNonEmptyString('export.destination.endpoint', destination.endpoint);
      try {
        new URL(destination.endpoint);
      } catch {
        throw new Error(
          '[Corelens] export.destination.endpoint must be a valid URL',
        );
      }
      return;

    default:
      throw new Error(
        `[Corelens] Unsupported export destination type: ${(destination as any).type}`,
      );
  }
}

function validateOtlpEndpoint(endpoint: string, field: string): void {
  let parsed: URL;

  try {
    parsed = new URL(endpoint);
  } catch {
    throw new Error(`[Corelens] ${field} must be a valid URL`);
  }
  const path = parsed.pathname;
  if (path !== '/' && path !== '') {
    throw new Error(
      `[Corelens] ${field} should be a base URL ` +
        `(e.g. "http://<host>:4318"), not a signal-specific path. ` +
        `Signal paths (/v1/traces, /v1/metrics, /v1/logs) are appended automatically. ` +
        `To use a custom path for a specific signal, use export.signals.<signal>.destination.endpoint instead.`,
    );
  }
}

function resolveEndpoint(base: string, signal: ExportSignal): string {
  return `${base.replace(/\/$/, '')}/v1/${signal}`;
}

function normaliseOtlpDestination(
  dest: OtlpHttpExportDestination,
  signalExports?: ExportSignalOverrides,
): NormalisedOtlpHttpExportDestination {
  validateOtlpEndpoint(dest.endpoint, 'export.destination.endpoint'); // throws if it contains /v1/

  const base = dest.endpoint.replace(/\/$/, '');
  const traceDest = signalExports?.traces?.destination;
  const metricsDest = signalExports?.metrics?.destination;
  const logsDest = signalExports?.logs?.destination;

  return {
    type: 'otlp-http',
    endpoint: base,
    resolvedEndpoints: {
      traces:
        traceDest?.type === 'otlp-http'
          ? (traceDest?.endpoint as string)
          : resolveEndpoint(base, 'traces'),
      metrics:
        metricsDest?.type === 'otlp-http'
          ? (metricsDest?.endpoint as string)
          : resolveEndpoint(base, 'metrics'),
      logs:
        logsDest?.type === 'otlp-http'
          ? (logsDest?.endpoint as string)
          : resolveEndpoint(base, 'logs'),
    },
    headers: dest?.headers ?? {},
    timeoutMs: normaliseOtlpTimeoutMs(dest.timeoutMs),
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Section normalisers
// Each function takes the raw optional sub-config and returns a fully-resolved,
// validated section. Defaults live here; validation lives in config.validators.
// ─────────────────────────────────────────────────────────────────────────────

function normaliseLogs(cfg: CorelensConfig['logs']): NormalisedLogConfig {
  return {
    enabled: cfg?.enabled ?? true,
    fullQueuePolicy: cfg?.fullQueuePolicy ?? 'drop-newest',
    maxQueueBytes: normaliseMaxQueueBytes(cfg?.maxQueueBytes),
    reportStatsOnShutdown: cfg?.reportStatsOnShutdown ?? false,
    format: cfg?.format ?? 'json',
    colorize: cfg?.colorize ?? false,
    level: cfg?.level ?? 'info',
    enrichWithTraceContext: cfg?.enrichWithTraceContext ?? false,
    timestamp: {
      format: cfg?.timestamp?.format ?? 'iso',
    },
    writer: {
      highWaterMark: normaliseHighWaterMark(cfg?.writer?.highWaterMark),
    },
  };
}

function normaliseMetrics(
  cfg: CorelensConfig['metrics'],
): NormalisedMetricsConfig {
  return {
    enabled: cfg?.enabled ?? false,
    maxSeriesPerMetric: normaliseMaxSeriesPerMetric(cfg?.maxSeriesPerMetric),
    runtime: {
      enabled: cfg?.runtime?.enabled ?? false,
      intervalMs: normaliseRuntimeInterval(cfg?.runtime?.intervalMs),
    },
    http: {
      enabled: cfg?.http?.enabled ?? false,
      buckets: cfg?.http?.buckets ?? DEFAULT_HTTP_BUCKETS,
      ignoredRoutes: cfg?.http?.ignoredRoutes ?? ['/metrics', '/health'],
    },
  };
}

function normaliseTraces(
  cfg: CorelensConfig['traces'],
): NormalisedTracesConfig {
  return {
    enabled: cfg?.enabled ?? false,
    samplingRate: normaliseSamplingRate(cfg?.samplingRate),
    http: {
      enabled: cfg?.http?.enabled ?? false,
      ignoredRoutes: cfg?.http?.ignoredRoutes ?? ['/metrics', '/health'],
    },
  };
}

function normaliseExport(
  cfg: CorelensConfig['export'],
): NormalisedExportConfig {
  // Destination must be present and valid before we normalise anything else.
  if (!cfg?.destination) {
    throw new Error('[Corelens] export.destination is required');
  }
  validateDestination(cfg.destination);

  // Resolve fields with cross-field dependencies in dependency order.
  const maxQueueSize = normaliseMaxQueueSize(cfg.batch?.maxQueueSize);
  const maxExportBatchSize = normaliseMaxExportBatchSize(
    cfg.batch?.maxExportBatchSize,
    maxQueueSize,
  );
  const initialDelayMs = normaliseRetryInitialDelayMs(
    cfg.retry?.initialDelayMs,
  );
  const maxDelayMs = normaliseRetryMaxDelayMs(
    cfg.retry?.maxDelayMs,
    initialDelayMs,
  );

  const destination = (
    cfg.destination.type === 'otlp-http'
      ? normaliseOtlpDestination(cfg.destination, cfg.signals)
      : cfg.destination
  ) as NormalisedExportDestination;

  const batch = {
    maxQueueSize,
    maxExportBatchSize,
    scheduledDelayMs: normaliseScheduledDelayMs(cfg.batch?.scheduledDelayMs),
    shutdownTimeoutMs: normaliseShutdownTimeoutMs(cfg.batch?.shutdownTimeoutMs),
    fullQueuePolicy: cfg.batch?.fullQueuePolicy ?? 'drop-newest',
  };

  // Final cross-field consistency check on the assembled batch config.
  validateBatchConfig(batch);

  const retry = {
    enabled: cfg.retry?.enabled ?? true,
    maxRetries: normaliseMaxRetries(cfg.retry?.maxRetries),
    initialDelayMs,
    maxDelayMs,
  };

  const circuitBreaker = {
    enabled: cfg.circuitBreaker?.enabled ?? true,
    failureThreshold: normaliseFailureThreshold(
      cfg.circuitBreaker?.failureThreshold,
    ),
    resetTimeoutMs: normaliseCircuitBreakerResetTimeoutMs(
      cfg.circuitBreaker?.resetTimeoutMs,
    ),
  };

  // Signal-level overrides are merged on top of the base export config.
  // Each signal inherits the base and selectively overrides only what's set.
  const baseSignal = {
    enabled: true,
    mode: cfg.mode ?? 'batch',
    destination,
    batch,
    retry,
    circuitBreaker,
  };
  const signals = {
    logs: {
      ...baseSignal,
      ...cfg.signals?.logs,
    } as NormalisedSignalExportConfig,
    metrics: {
      ...baseSignal,
      ...cfg.signals?.metrics,
    } as NormalisedSignalExportConfig,
    traces: {
      ...baseSignal,
      ...cfg.signals?.traces,
    } as NormalisedSignalExportConfig,
  };

  return {
    enabled: cfg.enabled ?? true,
    mode: cfg.mode ?? 'batch',
    destination,
    batch,
    retry,
    circuitBreaker,
    signals,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Root normaliser
// ─────────────────────────────────────────────────────────────────────────────

export function normaliseConfig(cfg: CorelensConfig): NormalisedConfig {
  if (!cfg.serviceName?.trim()) {
    throw new Error('[Corelens] serviceName is required during initialisation');
  }

  return {
    serviceName: cfg.serviceName,
    logs: normaliseLogs(cfg.logs),
    metrics: normaliseMetrics(cfg.metrics),
    traces: normaliseTraces(cfg.traces),
    export: normaliseExport(cfg.export),
    lifecycle: {
      handleProcessSignals: cfg.lifecycle?.handleProcessSignals ?? false,
    },
    diagnostics: {
      warnOnExportFailure: cfg.diagnostics?.warnOnExportFailure ?? true,
      warnOnConfigFallback: cfg.diagnostics?.warnOnConfigFallback ?? false,
    },
  };
}
