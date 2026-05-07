import {
  CorelensConfig,
  DEFAULT_MAX_QUEUE_SIZE,
  DEFAULT_STREAM_HIGHWATERMARK,
  FullQueuePolicy,
  NormalisedLogConfig,
} from './types';
import { intInRange, oneOf, requiredBoolean } from './primitives';

const LOG_FORMATS = ['json', 'pretty'] as const;
const LOG_LEVELS = ['debug', 'info', 'warn', 'error'] as const;
const TIMESTAMP_FORMATS = ['epoch', 'iso'] as const;
const QUEUE_POLICIES: readonly FullQueuePolicy[] = [
  'drop-newest',
  'drop-oldest',
];

export function normaliseLogConfig(
  cfg: CorelensConfig['logs'],
): NormalisedLogConfig {
  return {
    enabled: cfg ? requiredBoolean('logs.enabled', cfg.enabled) : true,
    maxQueueBytes: normaliseLogMaxQueueBytes(cfg?.maxQueueBytes),
    fullQueuePolicy: oneOf(
      'logs.fullQueuePolicy',
      cfg?.fullQueuePolicy ?? 'drop-newest',
      QUEUE_POLICIES,
    ),
    reportStatsOnShutdown: cfg?.reportStatsOnShutdown ?? false,
    writer: {
      highWaterMark: normaliseLogHighWaterMark(cfg?.writer?.highWaterMark),
    },
    timestamp: {
      format: oneOf(
        'logs.timestamp.format',
        cfg?.timestamp?.format ?? 'iso',
        TIMESTAMP_FORMATS,
      ),
    },
    format: oneOf('logs.format', cfg?.format ?? 'json', LOG_FORMATS),
    colorize: cfg?.colorize ?? false,
    level: oneOf('logs.level', cfg?.level ?? 'info', LOG_LEVELS),
    enrichWithTraceContext: cfg?.enrichWithTraceContext ?? false,
  };
}

export function normaliseLogMaxQueueBytes(value: unknown): number {
  return intInRange(
    'logs.maxQueueBytes',
    value ?? DEFAULT_MAX_QUEUE_SIZE,
    64 * 1024,
    512 * 1024 * 1024,
  );
}

export function normaliseLogHighWaterMark(value: unknown): number {
  return intInRange(
    'logs.writer.highWaterMark',
    value ?? DEFAULT_STREAM_HIGHWATERMARK,
    16 * 1024,
    16 * 1024 * 1024,
  );
}
