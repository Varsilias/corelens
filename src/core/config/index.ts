import { LogLevel } from '../logger';

export const DEFAULT_MAX_QUEUE_SIZE = 4 * 1024 * 1024;
export const DEFAULT_STREAM_HIGHWATERMARK = 64 * 1024;

export type FullQueuePolicy = 'drop-newest' | 'drop-oldest' | 'block';

export type CorelensLogConfig = {
  enabled: boolean;
  maxQueueBytes?: number;
  fullQueuePolicy?: 'drop-newest' | 'drop-oldest' | 'block';
  reportStatsOnShutdown?: boolean;
  writer?: {
    highWaterMark: number;
  };
  timestamp?: {
    format: 'epoch' | 'iso';
  };
  format?: 'json' | 'pretty';
  colorize?: boolean;
  level?: LogLevel;
  enrichWithTraceContext?: boolean;
};

export type CorelensMetricsConfig = {
  enabled: boolean;
  runtime?: {
    enabled: boolean;
    intervalMs: number;
  };
  http?: {
    enabled: boolean;
    buckets?: number[];
    ignoredRoutes?: string[];
  };
  maxSeriesPerMetric?: number;
};

export type CorelensTracesConfig = {
  enabled: boolean;
  samplingRate?: number; // 0-1
  http?: {
    enabled?: boolean;
    ignoredRoutes?: string[];
  };
};

export type CorelensConfig = {
  serviceName: string;
  logs?: CorelensLogConfig;
  metrics?: CorelensMetricsConfig;
  traces?: CorelensTracesConfig;
  lifecycle?: {
    handleProcessSignals?: boolean;
  };
};

// drop-newest: preserve old buffered logs, reject incoming pressure
// drop-oldest: preserve freshest logs
// block: preserve logs by applying backpressure to the producer

export type NormalisedLogConfig = {
  enabled: boolean;
  maxQueueBytes: number;
  fullQueuePolicy: 'drop-newest' | 'drop-oldest' | 'block';
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

export type NormalisedTracesConfig = {
  enabled: boolean;
  samplingRate: number;
  http: {
    enabled: boolean;
    ignoredRoutes: string[];
  };
};

export type NormalisedConfig = {
  serviceName: string;
  logs: NormalisedLogConfig;
  metrics: NormalisedMetricsConfig;
  traces: NormalisedTracesConfig;
  lifecycle: {
    handleProcessSignals: boolean;
  };
};

export type ModuleContext = {
  config: NormalisedConfig;
};

export interface Module {
  init(): void;
  start(): void;
  stop(): Promise<void>;
}
