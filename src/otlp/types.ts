export type OTLPSignalRequest = OTLPTraceSignal;

export type OTLPTraceSignal = {
  resourceSpans: OTLPTraceResource[];
};

export type OTLPTraceResource = {
  resource: {
    attributes: OTLPResourceAttribute[];
  };
  scopeSpans: OTLPScopeScan[];
};

export type OTLPResourceAttribute = {
  key: string;
  value:
    | { stringValue: string }
    | { intValue: string }
    | { boolValue: boolean }
    | { doubleValue: number };
};

export type OTLPScopeScan = {
  scope: OTLPScope;
  spans: OTLPSpan[];
};

export type OTLPScope = {
  name: string;
  version: string;
  attributes?: OTLPResourceAttribute[];
};

export type OTLPSpanEvent = {
  timeUnixNano: string;
  name: string;
  attributes: OTLPResourceAttribute[];
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
  attributes: OTLPResourceAttribute[];
};
