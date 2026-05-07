import { HttpMetricsRecorder } from '../adapter/http-metrics-recorder';
import { LogsModule, MetricsModule, TracesModule } from '../modules';
import { CorelensConfig, NormalisedConfig } from './config/types';
import { ILogger, Logger } from './logger';
import { Module } from './config/types';
import { NoopPipeline } from './logger/pipeline';
import { IMetricsRegistry, NoopMetricsRegistry } from './metrics/registry';
import { ITracer, NoopTracer } from './traces';
import { HttpTracingRecorder } from '../adapter/http-tracing-recorder';
import { normaliseCorelensConfig } from './config/root.config';

export type CorelensShutdownResult = {
  completed: boolean;
  durationMs: number;
  moduleCount: number;
  errors: Array<{
    module: string;
    message: string;
  }>;
};

const EMPTY_EXPORT_STATS = {
  flushCount: 0,
  failedExportCount: 0,
  lastExportError: undefined,
  lastExportErrorAt: undefined,
};

class Corelens {
  private modules: Module[] = [];
  private started: boolean = false;
  private shutdownPromise?: Promise<CorelensShutdownResult>;
  private lastShutdownResult?: CorelensShutdownResult;

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
        export: this.metricsModule.getSchedulerSnapshot() ?? EMPTY_EXPORT_STATS,
      },
      traces: {
        snapshot: this.tracesModule.snapshot(),
        finishedSpans: this.tracesModule.getFinishedSpans({ limit: 10 }),
      },
      shutdown: {
        inProgress: Boolean(this.shutdownPromise && this.started),
        lastResult: this.lastShutdownResult,
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
    if (!this.started) return this.lastShutdownResult;

    if (this.shutdownPromise) return this.shutdownPromise;

    const reversedModule = [...this.modules].reverse();
    this.shutdownPromise = (async () => {
      const startedAt = Date.now();
      const errors: CorelensShutdownResult['errors'] = [];

      for (const module of reversedModule) {
        try {
          await module.stop();
        } catch (error) {
          errors.push({
            module: module.constructor.name,
            message: error instanceof Error ? error.message : String(error),
          });
        }
      }
      if (this.config.logs.reportStatsOnShutdown) {
        process.stdout.write(JSON.stringify(this.getStats()) + '\n');
      }
      this.started = false;

      const result: CorelensShutdownResult = {
        completed: true,
        durationMs: Date.now() - startedAt,
        moduleCount: reversedModule.length,
        errors,
      };
      this.lastShutdownResult = result;
      return result;
    })();

    return this.shutdownPromise;
  }

  private attachProcessHandlers() {
    let shutdownInitiated = false;
    const handler = async (signal: NodeJS.Signals) => {
      if (shutdownInitiated) return;
      shutdownInitiated = true;

      process.off('SIGINT', handler);
      process.off('SIGTERM', handler);
      try {
        await this.shutdown();
      } finally {
        process.kill(process.pid, signal);
      }
    };

    process.on('SIGINT', handler);
    process.on('SIGTERM', handler);
  }
}

export function corelens(config: CorelensConfig): Corelens {
  const normalisedConfig = normaliseCorelensConfig(config);
  const sdk = new Corelens(normalisedConfig);
  sdk.start();
  return sdk;
}
