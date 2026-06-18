export type OTLPSignalRequest =
  | OTLPTraceRequest
  | OTLPMetricsRequest
  | OTLPLogsRequest;

// ===========================================
//            Traces
// ===========================================
export type OTLPTraceRequest = {
  resourceSpans: OTLPTraceResource[];
};

export type OTLPTraceResource = {
  resource: { attributes: OTLPAttribute[] };
  scopeSpans: OTLPScopeSpans[];
};

export type OTLPAttribute = {
  key: string;
  value:
    | { stringValue: string }
    | { intValue: string }
    | { boolValue: boolean }
    | { doubleValue: number };
};

export type OTLPScopeSpans = {
  scope: OTLPScope;
  spans: OTLPSpan[];
};

export type OTLPScope = {
  name: string;
  version: string;
  attributes?: OTLPAttribute[];
};

export type OTLPSpanEvent = {
  timeUnixNano: string;
  name: string;
  attributes: OTLPAttribute[];
};

export type OTLPSpan = {
  traceId: string;
  spanId: string;
  parentSpanId?: string;
  name: string;
  startTimeUnixNano: string;
  endTimeUnixNano: string;
  kind: number;
  status: {
    code: number;
    message?: string;
  };
  events: OTLPSpanEvent[];
  attributes: OTLPAttribute[];
};

// ===========================================
//            Metrics
// ===========================================

export type OTLPMetricsRequest = {
  resourceMetrics: OTLPResourceMetrics[];
};

export type OTLPResourceMetrics = {
  resource: { attributes: OTLPAttribute[] };
  scopeMetrics: OTLPScopeMetrics[];
};

export type OTLPScopeMetrics = {
  scope: { name: string; version: string };
  metrics: OTLPMetric[];
};

export type OTLPMetric = {
  name: string;
  description: string;
  unit: string;
  sum?: OTLPSum;
  gauge?: OTLPGauge;
  histogram?: OTLPHistogram;
};

export type OTLPNumberDataPoint = {
  attributes: OTLPAttribute[];
  asDouble: number;
  timeUnixNano: string;
};
export type OTLPSum = {
  dataPoints: OTLPNumberDataPoint[];
  isMonotonic: boolean;
  aggregationTemporality: number;
};
export type OTLPGauge = { dataPoints: OTLPNumberDataPoint[] };
export type OTLPHistogramDataPoint = {
  attributes: OTLPAttribute[];
  timeUnixNano: string;
  count: string;
  sum: number;
  bucketCounts: string[];
  explicitBounds: number[];
};
export type OTLPHistogram = {
  dataPoints: OTLPHistogramDataPoint[];
  aggregationTemporality: number;
};

// ===========================================
//            Logs
// ===========================================

// OTLP severity numbers per the spec:
// https://opentelemetry.io/docs/specs/otel/logs/data-model/#field-severitynumber
export const SEVERITY_NUMBER: Record<string, number> = {
  debug: 5,
  info: 9,
  warn: 13,
  error: 17,
};

export type OTLPLogsRequest = {
  resourceLogs: OTLPResourceLogs[];
};

export type OTLPResourceLogs = {
  resource: { attributes: OTLPAttribute[] };
  scopeLogs: OTLPScopeLogs[];
};

export type OTLPScopeLogs = {
  scope: { name: string; version: string };
  logRecords: OTLPLogRecord[];
};

export type OTLPLogRecord = {
  timeUnixNano: string;
  observedTimeUnixNano: string;
  severityNumber: number;
  severityText: string;
  body: { stringValue: string };
  attributes: OTLPAttribute[];
  traceId?: string;
  spanId?: string;
};

export function labelsToAttributes(
  labels:
    | Record<string, string>
    | { [x: string]: string | number | boolean }
    | undefined,
): OTLPAttribute[] {
  if (!labels) {
    return [];
  }
  if (typeof labels === 'string') {
    return [{ key: 'context', value: { stringValue: labels } }];
  }

  if (Array.isArray(labels)) {
    return [{ key: 'context', value: { stringValue: labels.join(', ') } }];
  }
  return Object.entries(labels).map(([key, value]) => ({
    key,
    value: formatValue(value),
  }));
}

export function formatValue(value: unknown) {
  if (typeof value === 'string') return { stringValue: value };
  if (typeof value === 'boolean') return { boolValue: value };
  if (typeof value === 'number') {
    return Number.isInteger(value)
      ? { intValue: value.toString() }
      : { doubleValue: value };
  }

  return { stringValue: String(value) };
}
