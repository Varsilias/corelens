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
  NormalisedExportConfig,
  NormalisedLogConfig,
  NormalisedMetricsConfig,
  NormalisedTracesConfig,
} from './config';
import { ILogger, Logger } from './logger';
import { Module } from './config';
import { NoopPipeline } from './logger/pipeline';
import { IMetricsRegistry, NoopMetricsRegistry } from './metrics/registry';
import { ITracer, NoopTracer } from './traces';
import { HttpTracingRecorder } from '../adapter/http-tracing-recorder';

class Corelens {
  private modules: Module[] = [];
  private started: boolean = false;
  private shutdownPromise?: Promise<void>;

  // specific module wiring
  private logsModule: LogsModule;
  private metricsModule: MetricsModule;
  private tracesModule: TracesModule;

  // public APIs
  public logger: ILogger;
  public metrics: IMetricsRegistry;
  public tracer: ITracer;
  public httpMetricsRecorder: HttpMetricsRecorder;
  public httpTracingRecorder: HttpTracingRecorder;

  constructor(public config: NormalisedConfig) {
    // Traces
    const tracesModule = new TracesModule({ config });
    this.tracesModule = tracesModule;

    const tracer = config.traces.enabled
      ? tracesModule.getTracer()
      : new NoopTracer();

    if (config.traces.enabled) {
      this.modules.push(tracesModule);
    }
    this.tracer = tracer;

    // Logs
    const logsModule = new LogsModule({ config });
    this.logsModule = logsModule;

    if (config.logs.enabled) {
      this.modules.push(logsModule);
    }
    this.logger = new Logger(
      config,
      config.logs.enabled ? logsModule.getPipeline() : new NoopPipeline(),
      tracer,
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

    this.httpMetricsRecorder = new HttpMetricsRecorder(this.metrics, {
      enabled: config.metrics.http.enabled,
      buckets: config.metrics.http.buckets,
      ignoredRoutes: config.metrics.http.ignoredRoutes,
    });

    this.httpTracingRecorder = new HttpTracingRecorder(this.tracer, {
      enabled: config.traces.http.enabled,
      ignoredRoutes: config.traces.http.ignoredRoutes,
    });

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
      traces: {
        snapshot: this.tracesModule.snapshot(),
        finishedSpans: this.tracesModule.getFinishedSpans({ limit: 10 }),
      },
    };
  }

  getFinishedSpans(ctx: { limit: number }) {
    return this.tracesModule.getFinishedSpans(ctx);
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

  const logsCfg = cfg?.logs;
  const logs: NormalisedLogConfig = {
    enabled: logsCfg?.enabled ?? true,
    fullQueuePolicy: logsCfg?.fullQueuePolicy ?? 'drop-newest',
    maxQueueBytes: logsCfg?.maxQueueBytes ?? DEFAULT_MAX_QUEUE_SIZE,
    reportStatsOnShutdown: logsCfg?.reportStatsOnShutdown ?? false,
    format: logsCfg?.format ?? 'json',
    colorize: logsCfg?.colorize ?? false,
    level: logsCfg?.level ?? 'info',
    enrichWithTraceContext: logsCfg?.enrichWithTraceContext ?? false,
    timestamp: {
      format: logsCfg?.timestamp?.format ?? 'iso',
    },
    writer: {
      highWaterMark:
        logsCfg?.writer?.highWaterMark ?? DEFAULT_STREAM_HIGHWATERMARK,
    },
  };

  const metricsCfg = cfg?.metrics;
  const metrics: NormalisedMetricsConfig = {
    enabled: metricsCfg?.enabled ?? false,
    maxSeriesPerMetric: metricsCfg?.maxSeriesPerMetric ?? 1000,
    runtime: {
      enabled: metricsCfg?.runtime?.enabled ?? false,
      intervalMs: metricsCfg?.runtime?.intervalMs ?? 15000,
    },
    http: {
      enabled: metricsCfg?.http?.enabled ?? false,
      buckets: metricsCfg?.http?.buckets ?? DEFAULT_HTTP_BUCKETS,
      ignoredRoutes: metricsCfg?.http?.ignoredRoutes ?? ['/metrics', '/health'],
    },
  };

  const tracesCfg = cfg?.traces;
  const traces: NormalisedTracesConfig = {
    enabled: tracesCfg?.enabled ?? false,
    samplingRate: normalizeSamplingRate(tracesCfg?.samplingRate),
    http: {
      enabled: tracesCfg?.http?.enabled ?? false,
      ignoredRoutes: tracesCfg?.http?.ignoredRoutes ?? ['/metrics', '/health'],
    },
    batch: {
      fullQueuePolicy: tracesCfg?.batch?.fullQueuePolicy ?? 'drop-newest',
      maxExportBatchSize: tracesCfg?.batch?.maxExportBatchSize ?? 512,
      maxQueueSize: tracesCfg?.batch?.maxQueueSize ?? 2048,
      scheduledDelayMs: tracesCfg?.batch?.scheduledDelayMs ?? 5000,
    },
  };

  const exportCfg = cfg?.export;
  const exportConfig: NormalisedExportConfig = {
    protocol: exportCfg?.protocol ?? 'otlp-http',
    endpoint: exportCfg?.endpoint ?? '',
    timeoutMs: exportCfg?.timeoutMs ?? 3000,
    retry: {
      enabled: exportCfg?.retry?.enabled ?? true,
      initialDelayMs: exportCfg?.retry?.initialDelayMs ?? 100,
      maxDelayMs: exportCfg?.retry?.maxDelayMs ?? 2000,
      maxRetries: exportCfg?.retry?.maxRetries ?? 3,
    },
    circuitBreaker: {
      enabled: exportCfg?.circuitBreaker?.enabled ?? true,
      failureThreshold: exportCfg?.circuitBreaker?.failureThreshold ?? 5,
      resetTimeoutMs: exportCfg?.circuitBreaker?.resetTimeoutMs ?? 30000,
    },
  };

  const config: NormalisedConfig = {
    serviceName: cfg.serviceName,
    logs,
    metrics,
    traces,
    export: exportConfig,
    lifecycle: {
      handleProcessSignals: cfg?.lifecycle?.handleProcessSignals ?? false,
      warnOnError: cfg?.lifecycle?.warnOnError ?? true,
    },
  };

  return config;
}

function normalizeSamplingRate(value: unknown): number {
  if (value === undefined) return 1;

  if (typeof value !== 'number' || Number.isNaN(value)) {
    throw new Error('samplingRate must be a number between 0 and 1');
  }

  if (value < 0 || value > 1) {
    throw new Error('samplingRate must be between 0 and 1');
  }

  return value;
}
