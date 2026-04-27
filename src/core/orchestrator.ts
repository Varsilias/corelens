import {
  DEFAULT_HTTP_BUCKETS,
  HttpMetricsRecorder,
} from '../adapter/http-metrics-recorder';
import { LogsModule, MetricsModule, TracesModule } from '../modules';
import {
  CorelensConfig,
  DEFAULT_STREAM_HIGHWATERMARK,
  MAX_QUEUE_SIZE,
  NormalisedConfig,
} from './config';
import { ILogger, Logger } from './logger';
import { Module } from './modules';
import { NoopPipeline } from './pipeline';
import { IMetricsRegistry, NoopMetricsRegistry } from './registry';

class Corelens {
  private modules: Module[] = [];
  private started: boolean = false;
  private shutdownPromise?: Promise<void>;

  // specific module wiring
  private logsModule: LogsModule;
  private metricsModule: MetricsModule;

  // public APIs
  public logger: ILogger;
  public metrics: IMetricsRegistry;
  public httpRecorder: HttpMetricsRecorder;

  constructor(public config: NormalisedConfig) {
    const logsModule = new LogsModule({ config });
    this.logsModule = logsModule;

    if (config.logs.enabled) {
      this.modules.push(logsModule);
    }
    this.logger = new Logger(
      config,
      config.logs.enabled ? logsModule.getPipeline() : new NoopPipeline(),
    );

    // Metrics
    const metricsModule = new MetricsModule({ config });
    this.metricsModule = metricsModule;

    if (config.metrics.enabled) {
      this.modules.push(metricsModule);
    }

    this.metrics = config.metrics.enabled
      ? metricsModule.getRegistry()
      : new NoopMetricsRegistry();
    this.httpRecorder = new HttpMetricsRecorder(this.metrics, {
      enabled: config.metrics.http.enabled,
      buckets: config.metrics.http.buckets,
      ignoredRoutes: config.metrics.http.ignoredRoutes,
    });

    // Traces
    if (config.traces) this.modules.push(new TracesModule({ config }));

    // process signal
    if (config.lifecycle.handleProcessSignals) {
      this.attachProcessHandlers();
    }
  }

  getMetricsSnapshot() {
    return this.metricsModule.getFullSnapshot();
  }

  getStats() {
    return {
      logs: this.logsModule.getPipelineStats(),
      metrics: this.metricsModule.getFullSnapshot(),
    };
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

  async shutdown() {
    if (!this.started) return;

    if (this.shutdownPromise) return this.shutdownPromise;

    const reversedModule = [...this.modules].reverse();
    this.shutdownPromise = (async () => {
      for (const module of reversedModule) {
        await module.stop();
      }
      if (this.config.logs.reportStatsOnShutdown) {
        process.stdout.write(JSON.stringify(this.getStats()) + '\n');
      }
      this.started = false;
    })();

    return this.shutdownPromise;
  }

  private attachProcessHandlers() {
    const handler = async () => {
      await this.shutdown();
    };

    process.on('SIGINT', handler);
    process.on('SIGTERM', handler);
  }
}

export function corelens(config: CorelensConfig): Corelens {
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
    logs: {
      enabled: corelensConfig?.logs?.enabled ?? true,
      fullQueuePolicy: corelensConfig?.logs?.fullQueuePolicy ?? 'drop-newest',
      maxQueueBytes: corelensConfig?.logs?.maxQueueBytes ?? MAX_QUEUE_SIZE,
      reportStatsOnShutdown:
        corelensConfig?.logs?.reportStatsOnShutdown ?? false,
      writer: {
        highWaterMark:
          corelensConfig?.logs?.writer?.highWaterMark ??
          DEFAULT_STREAM_HIGHWATERMARK,
      },
    },
    metrics: {
      enabled: corelensConfig?.metrics?.enabled ?? false,
      runtime: {
        enabled: corelensConfig?.metrics?.runtime?.enabled ?? false,
        intervalMs: corelensConfig?.metrics?.runtime?.intervalMs ?? 15000,
      },
      http: {
        enabled: corelensConfig?.metrics?.http?.enabled ?? false,
        buckets: corelensConfig?.metrics?.http?.buckets ?? DEFAULT_HTTP_BUCKETS,
        ignoredRoutes: corelensConfig?.metrics?.http?.ignoredRoutes ?? [
          '/metrics',
          '/health',
        ],
      },
    },
    traces: corelensConfig.traces ?? false,
    lifecycle: {
      handleProcessSignals:
        corelensConfig?.lifecycle?.handleProcessSignals ?? false,
    },
  } as NormalisedConfig;

  return config;
}
