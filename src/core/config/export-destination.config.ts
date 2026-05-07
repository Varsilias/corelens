import {
  ExportDestination,
  ExportSignal,
  ExportSignalOverrides,
  SignalExportOverride,
  NormalisedExportDestination,
  NormalisedOtlpHttpExportDestination,
  OtlpHttpExportDestination,
} from './types';
import {
  intInRange,
  nonEmptyString,
  optionalRecordOfStrings,
  url,
} from './primitives';

export function normaliseExportDestination(
  destination: ExportDestination,
  signalOverrides?: ExportSignalOverrides,
): NormalisedExportDestination {
  switch (destination.type) {
    case 'console':
      return {
        type: 'console',
        pretty: destination.pretty ?? false,
      };
    case 'file':
      return {
        type: 'file',
        filePath: nonEmptyString(
          'export.destination.filePath',
          destination.filePath,
        ),
      };
    case 'otlp-http':
      return normaliseOtlpDestination(destination, signalOverrides);
    default:
      throw new Error(
        `[Corelens] Unsupported export destination type: ${(destination as any).type}`,
      );
  }
}

export function normaliseSignalDestination(
  base: NormalisedExportDestination,
  destination: SignalExportOverride['destination'] | undefined,
  signal: ExportSignal,
): NormalisedExportDestination {
  if (!destination) return base;

  const type = destination.type ?? base.type;
  switch (type) {
    case 'console':
      return {
        type: 'console',
        pretty:
          destination.type === 'console'
            ? (destination.pretty ??
              (base.type === 'console' ? base.pretty : false))
            : base.type === 'console'
              ? base.pretty
              : false,
      };
    case 'file': {
      const filePath =
        destination.type === 'file'
          ? destination.filePath
          : base.type === 'file'
            ? base.filePath
            : undefined;
      return {
        type: 'file',
        filePath: nonEmptyString(
          `export.signals.${signal}.destination.filePath`,
          filePath,
        ),
      };
    }
    case 'otlp-http':
      return normaliseSignalOtlpDestination(base, destination, signal);
    default:
      throw new Error(
        `[Corelens] Unsupported export destination type: ${(destination as any).type}`,
      );
  }
}

function normaliseOtlpDestination(
  destination: OtlpHttpExportDestination,
  signalOverrides?: ExportSignalOverrides,
): NormalisedOtlpHttpExportDestination {
  const baseEndpoint = normaliseBaseOtlpEndpoint(
    'export.destination.endpoint',
    destination.endpoint,
  );

  return {
    type: 'otlp-http',
    endpoint: baseEndpoint,
    resolvedEndpoints: {
      traces: signalEndpoint(baseEndpoint, signalOverrides?.traces, 'traces'),
      metrics: signalEndpoint(
        baseEndpoint,
        signalOverrides?.metrics,
        'metrics',
      ),
      logs: signalEndpoint(baseEndpoint, signalOverrides?.logs, 'logs'),
    },
    headers: optionalRecordOfStrings(
      'export.destination.headers',
      destination.headers,
    ),
    timeoutMs: normaliseOtlpTimeoutMs(destination.timeoutMs),
  };
}

function normaliseSignalOtlpDestination(
  base: NormalisedExportDestination,
  destination: SignalExportOverride['destination'],
  signal: ExportSignal,
): NormalisedOtlpHttpExportDestination {
  const endpoint =
    destination?.type === 'otlp-http'
      ? destination.endpoint
      : base.type === 'otlp-http'
        ? base.endpoint
        : undefined;
  const normalisedEndpoint = url(
    `export.signals.${signal}.destination.endpoint`,
    endpoint,
  );
  const baseHeaders = base.type === 'otlp-http' ? base.headers : {};
  const baseTimeoutMs = base.type === 'otlp-http' ? base.timeoutMs : undefined;
  const baseResolvedEndpoints =
    base.type === 'otlp-http'
      ? base.resolvedEndpoints
      : {
          traces: appendSignalPath(normalisedEndpoint, 'traces'),
          metrics: appendSignalPath(normalisedEndpoint, 'metrics'),
          logs: appendSignalPath(normalisedEndpoint, 'logs'),
        };

  return {
    type: 'otlp-http',
    endpoint: normalisedEndpoint,
    headers:
      destination?.type === 'otlp-http'
        ? {
            ...baseHeaders,
            ...optionalRecordOfStrings(
              `export.signals.${signal}.destination.headers`,
              destination.headers,
            ),
          }
        : baseHeaders,
    timeoutMs: normaliseOtlpTimeoutMs(
      destination?.type === 'otlp-http'
        ? (destination.timeoutMs ?? baseTimeoutMs)
        : baseTimeoutMs,
      `export.signals.${signal}.destination.timeoutMs`,
    ),
    resolvedEndpoints: {
      ...baseResolvedEndpoints,
      [signal]: normalisedEndpoint,
    },
  };
}

function normaliseBaseOtlpEndpoint(field: string, value: unknown): string {
  const endpoint = url(field, value);
  const parsed = new URL(endpoint);
  if (parsed.pathname !== '/' && parsed.pathname !== '') {
    throw new Error(
      `[Corelens] ${field} should be a base URL, not a signal-specific path`,
    );
  }
  return endpoint.replace(/\/$/, '');
}

function normaliseOtlpTimeoutMs(
  value: unknown,
  field = 'export.destination.timeoutMs',
): number {
  return intInRange(field, value ?? 3_000, 100, 60_000);
}

function signalEndpoint(
  baseEndpoint: string,
  override: ExportSignalOverrides[ExportSignal] | undefined,
  signal: ExportSignal,
): string {
  const destination = override?.destination;
  if (destination?.type === 'otlp-http') {
    return url(
      `export.signals.${signal}.destination.endpoint`,
      destination.endpoint,
    );
  }
  return appendSignalPath(baseEndpoint, signal);
}

function appendSignalPath(baseEndpoint: string, signal: ExportSignal): string {
  return `${baseEndpoint.replace(/\/$/, '')}/v1/${signal}`;
}
