import { LogLevel } from '../logger';

/**
 * ===================================================
 *                     Defaults
 * ===================================================
 */

export const DEFAULT_MAX_QUEUE_SIZE = 1 * 1024 * 1024; // 1MB
export const DEFAULT_STREAM_HIGHWATERMARK = 64 * 1024; // 64KB  Node's default is 16KB
export const DEFAULT_HTTP_BUCKETS = [
  0.005, // 5ms
  0.01, // 10ms
  0.025, // 25ms
  0.05, // 50ms
  0.1, // 100ms
  0.25, // 250ms
  0.5, // 500ms
  1, // 1s
  2.5, // 2.5s
  5, // 5s
  10, // 10s
];

/**
 * ===================================================
 *                  Shared Types
 * ===================================================
 */

// drop-newest: preserve old buffered data, reject incoming pressure
// drop-oldest: preserve freshest data
// future(block): preserve data by applying backpressure to the producer
export type FullQueuePolicy = 'drop-newest' | 'drop-oldest';

export type ExportSignal = 'logs' | 'metrics' | 'traces';

export type ExportDestinationType = 'console' | 'file' | 'otlp-http';

export type ExportMode = 'simple' | 'batch';

/**
 * ===================================================
 *                Export Configuration
 * ===================================================
 */

export type ConsoleExportDestination = {
  type: 'console';
  pretty?: boolean;
};

export type FileExportDestination = {
  type: 'file';
  filePath: string;
};

export type OtlpHttpExportDestination = {
  type: 'otlp-http';
  endpoint: string; // base URL only e.g: "http://otel-collector:4318"
  headers?: Record<string, string>;
  timeoutMs?: number;
};

export type ExportDestination =
  | ConsoleExportDestination
  | FileExportDestination
  | OtlpHttpExportDestination;

export type ExportBatchConfig = {
  maxQueueSize?: number;
  maxExportBatchSize?: number;
  scheduledDelayMs?: number;
  shutdownTimeoutMs?: number;
  fullQueuePolicy?: FullQueuePolicy;
};

export type ExportRetryConfig = {
  enabled?: boolean;
  maxRetries?: number;
  initialDelayMs?: number;
  maxDelayMs?: number;
};

export type ExportCircuitBreakerConfig = {
  enabled?: boolean;
  failureThreshold?: number;
  resetTimeoutMs?: number;
};

export type SignalExportOverride = {
  enabled: boolean;
  mode?: ExportMode;
  destination?: Partial<ExportDestination> & {
    type?: ExportDestinationType;
  };
  batch?: Partial<ExportBatchConfig>;
  retry?: Partial<ExportRetryConfig>;
  circuitBreaker?: Partial<ExportCircuitBreakerConfig>;
};

export type ExportSignalOverrides = {
  logs?: SignalExportOverride;
  metrics?: SignalExportOverride;
  traces?: SignalExportOverride;
};

export type CorelensExportConfig = {
  enabled: boolean;
  mode?: ExportMode;
  destination: ExportDestination;
  batch?: ExportBatchConfig;
  retry?: ExportRetryConfig;
  circuitBreaker?: ExportCircuitBreakerConfig;
  signals?: ExportSignalOverrides;
};

// export type CorelensExportConfig =
//   | { enabled: boolean }
//   | {
//       enabled: boolean;
//       mode?: ExportMode;
//       destination: ExportDestination;
//       batch?: ExportBatchConfig;
//       retry?: ExportRetryConfig;
//       circuitBreaker?: ExportCircuitBreakerConfig;
//       signals?: ExportSignalOverrides;
//     };
/**
 * ===================================================
 *                Logs Configuration
 * ===================================================
 */

export type CorelensLogConfig = {
  enabled: boolean;
  maxQueueBytes?: number;
  fullQueuePolicy?: FullQueuePolicy;
  reportStatsOnShutdown?: boolean;
  writer?: {
    highWaterMark?: number;
  };
  timestamp?: {
    format?: 'epoch' | 'iso';
  };
  format?: 'json' | 'pretty';
  colorize?: boolean;
  level?: LogLevel;
  enrichWithTraceContext?: boolean;
};

/**
 * ===================================================
 *                Metrics Configuration
 * ===================================================
 */

export type CorelensMetricsConfig = {
  enabled: boolean;
  runtime?: {
    enabled?: boolean;
    intervalMs?: number;
  };
  http?: {
    enabled?: boolean;
    buckets?: number[];
    ignoredRoutes?: string[];
  };
  maxSeriesPerMetric?: number;
};

/**
 * ===================================================
 *                Traces Configuration
 * ===================================================
 */

export type CorelensTracesConfig = {
  enabled: boolean;
  samplingRate?: number; // 0-1
  http?: {
    enabled?: boolean;
    ignoredRoutes?: string[];
  };
};

/**
 * ===================================================
 *                Root Configuration
 * ===================================================
 */

export type CorelensConfig = {
  serviceName: string;
  logs?: CorelensLogConfig;
  metrics?: CorelensMetricsConfig;
  traces?: CorelensTracesConfig;
  lifecycle?: {
    handleProcessSignals?: boolean;
  };
  diagnostics?: {
    warnOnExportFailure?: boolean;
    warnOnConfigFallback?: boolean;
  };
  export?: CorelensExportConfig;
};

/**
 * ===================================================
 *             Normalised Export Configuration
 * ===================================================
 */

export type NormalisedConsoleExportDestination = {
  type: 'console';
  pretty: boolean;
};

export type NormalisedFileExportDestination = {
  type: 'file';
  filePath: string;
};

export type NormalisedOtlpHttpExportDestination = {
  type: 'otlp-http';
  // Base URL is stored for reference but modules use resolvedEndpoints
  endpoint: string;
  resolvedEndpoints: {
    traces: string;
    metrics: string;
    logs: string;
  };
  headers: Record<string, string>;
  timeoutMs: number;
};

export type NormalisedExportDestination =
  | NormalisedConsoleExportDestination
  | NormalisedFileExportDestination
  | NormalisedOtlpHttpExportDestination;

export type NormalisedExportBatchConfig = {
  maxQueueSize: number;
  maxExportBatchSize: number;
  scheduledDelayMs: number;
  shutdownTimeoutMs: number;
  fullQueuePolicy: FullQueuePolicy;
};

export type NormalisedExportRetryConfig = {
  enabled: boolean;
  maxRetries: number;
  initialDelayMs: number;
  maxDelayMs: number;
};

export type NormalisedExportCircuitBreakerConfig = {
  enabled: boolean;
  failureThreshold: number;
  resetTimeoutMs: number;
};

export type NormalisedSignalExportConfig = {
  enabled: boolean;
  mode: ExportMode;
  destination: NormalisedExportDestination;
  batch: NormalisedExportBatchConfig;
  retry: NormalisedExportRetryConfig;
  circuitBreaker: NormalisedExportCircuitBreakerConfig;
};

export type NormalisedExportConfig = {
  enabled: boolean;
  mode: ExportMode;
  destination: NormalisedExportDestination;
  batch: NormalisedExportBatchConfig;
  retry: NormalisedExportRetryConfig;
  circuitBreaker: NormalisedExportCircuitBreakerConfig;
  signals: {
    logs: NormalisedSignalExportConfig;
    metrics: NormalisedSignalExportConfig;
    traces: NormalisedSignalExportConfig;
  };
};

/**
 * ===================================================
 *             Normalised Logs Configuration
 * ===================================================
 */

export type NormalisedLogConfig = {
  enabled: boolean;
  maxQueueBytes: number;
  fullQueuePolicy: FullQueuePolicy;
  reportStatsOnShutdown: boolean;
  writer: {
    highWaterMark: number;
  };
  timestamp: {
    format: 'epoch' | 'iso';
  };
  format: 'json' | 'pretty';
  colorize: boolean;
  level: LogLevel;
  enrichWithTraceContext: boolean;
};

/**
 * ===================================================
 *             Normalised Metrics Configuration
 * ===================================================
 */

export type NormalisedMetricsConfig = {
  enabled: boolean;
  runtime: {
    enabled: boolean;
    intervalMs: number;
  };
  http: {
    enabled: boolean;
    buckets: number[];
    ignoredRoutes: string[];
  };
  maxSeriesPerMetric: number;
};

/**
 * ===================================================
 *             Normalised Traces Configuration
 * ===================================================
 */

export type NormalisedTracesConfig = {
  enabled: boolean;
  samplingRate: number;
  http: {
    enabled: boolean;
    ignoredRoutes: string[];
  };
};

/**
 * ===================================================
 *             Normalised Root Configuration
 * ===================================================
 */

export type NormalisedConfig = {
  serviceName: string;
  logs: NormalisedLogConfig;
  metrics: NormalisedMetricsConfig;
  traces: NormalisedTracesConfig;
  lifecycle: {
    handleProcessSignals: boolean;
  };
  diagnostics: {
    warnOnExportFailure: boolean;
    warnOnConfigFallback: boolean;
  };
  export: NormalisedExportConfig;
};

/**
 * ===================================================
 *                  Module System
 * ===================================================
 */

export type ModuleContext = {
  config: NormalisedConfig;
};

export interface Module {
  init(): void;
  start(): void;
  stop(): Promise<void>;
}

export interface SignalFormatter<T, R> {
  format(record: T | T[]): R;
}
