import { LogsModule, MetricsModule, TracesModule } from '../modules';
import { CorelensConfig, NormalisedConfig } from './config';
import { Module } from './modules';

class Corelens {
  private modules: Module[] = [];
  private started: boolean = false;

  constructor(config: NormalisedConfig) {
    if (config.logs) this.modules.push(new LogsModule({ config }));
    if (config.metrics) this.modules.push(new MetricsModule({ config }));
    if (config.traces) this.modules.push(new TracesModule({ config }));
  }

  start() {
    if (this.started) return;
    try {
      for (const module of this.modules) {
        module.init();
      }

      for (const module of this.modules) {
        module.start();
      }
      this.started = true;
    } catch (error) {
      this.shutdown();
      throw error;
    }
  }

  shutdown() {
    for (const module of this.modules) {
      module.stop();
    }
    this.started = false;
  }
}

export function otel(config: CorelensConfig): Corelens {
  const normalisedConfig = normaliseConfig(config);
  const sdk = new Corelens(normalisedConfig);
  sdk.start();
  return sdk;
}

function normaliseConfig(corelensConfig: CorelensConfig): NormalisedConfig {
  if (!corelensConfig.serviceName) {
    throw new Error('serviceName is required during initialisation');
  }

  const config = {
    serviceName: corelensConfig.serviceName,
    logs: corelensConfig.logs ?? false,
    metrics: corelensConfig.metrics ?? false,
    traces: corelensConfig.traces ?? false,
  } as NormalisedConfig;

  return config;
}
