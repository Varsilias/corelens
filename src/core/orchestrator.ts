import {
  DEFAULT_HTTP_BUCKETS,
  HttpMetricsRecorder,
} from '../adapter/http-metrics-recorder';
import { LogsModule, MetricsModule, TracesModule } from '../modules';
import {
  CorelensConfig,
  DEFAULT_MAX_QUEUE_SIZE,
  DEFAULT_STREAM_HIGHWATERMARK,
  NormalisedConfig,
} from './config';
import { ILogger, Logger } from './logger';
import { Module } from './config';
import { NoopPipeline } from './logger/pipeline';
import { IMetricsRegistry, NoopMetricsRegistry } from './metrics/registry';

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
      metrics: {
        snapshot: this.metricsModule.getFullSnapshot(),
        labelCardinalitySnapshot: this.metricsModule.getCardinalitySnapshot(),
      },
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

function normaliseConfig(cfg: CorelensConfig): NormalisedConfig {
  if (!cfg.serviceName) {
    throw new Error('serviceName is required during initialisation');
  }

  const config = {
    serviceName: cfg.serviceName,
    logs: {
      enabled: cfg?.logs?.enabled ?? true,
      fullQueuePolicy: cfg?.logs?.fullQueuePolicy ?? 'drop-newest',
      maxQueueBytes: cfg?.logs?.maxQueueBytes ?? DEFAULT_MAX_QUEUE_SIZE,
      reportStatsOnShutdown: cfg?.logs?.reportStatsOnShutdown ?? false,
      timestamp: {
        format: cfg?.logs?.timestamp?.format ?? 'iso',
      },
      writer: {
        highWaterMark:
          cfg?.logs?.writer?.highWaterMark ?? DEFAULT_STREAM_HIGHWATERMARK,
      },
      format: cfg?.logs?.format ?? 'json',
      colorize: cfg?.logs?.colorize ?? false,
      level: cfg?.logs?.level ?? 'info',
    },
    metrics: {
      enabled: cfg?.metrics?.enabled ?? false,
      runtime: {
        enabled: cfg?.metrics?.runtime?.enabled ?? false,
        intervalMs: cfg?.metrics?.runtime?.intervalMs ?? 15000,
      },
      http: {
        enabled: cfg?.metrics?.http?.enabled ?? false,
        buckets: cfg?.metrics?.http?.buckets ?? DEFAULT_HTTP_BUCKETS,
        ignoredRoutes: cfg?.metrics?.http?.ignoredRoutes ?? [
          '/metrics',
          '/health',
        ],
      },
      maxSeriesPerMetric: cfg?.metrics?.maxSeriesPerMetric ?? 1000,
    },
    traces: cfg.traces ?? false,
    lifecycle: {
      handleProcessSignals: cfg?.lifecycle?.handleProcessSignals ?? false,
    },
  } as NormalisedConfig;

  return config;
}
