export type OTLPSignalRequest = OTLPTraceRequest | OTLPMetricsRequest;

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

export function labelsToAttributes(
  labels: Record<string, string>,
): OTLPAttribute[] {
  return Object.entries(labels).map(([key, value]) => ({
    key,
    value: { stringValue: value },
  }));
}
