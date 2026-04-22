export type CorelensConfig = {
  serviceName: string;
  logs?: boolean;
  metrics?: boolean;
  traces?: boolean;
};

export type NormalisedConfig = {
  serviceName: string;
  logs: boolean;
  metrics: boolean;
  traces: boolean;
};
