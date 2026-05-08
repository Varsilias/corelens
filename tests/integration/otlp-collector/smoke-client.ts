import { corelens } from '../../../src';

const collectorEndpoint =
  process.env.CORELENS_OTLP_ENDPOINT ?? 'http://127.0.0.1:4318';
const collectorHealthUrl =
  process.env.CORELENS_OTLP_HEALTH_URL ?? 'http://127.0.0.1:13133/';

async function assertCollectorIsReachable() {
  try {
    const response = await fetch(collectorHealthUrl);
    if (!response.ok) {
      throw new Error(`health endpoint returned HTTP ${response.status}`);
    }
  } catch (error) {
    throw new Error(
      [
        `OpenTelemetry Collector is not reachable at ${collectorHealthUrl}.`,
        'Start it from tests/integration/otlp-collector with `docker compose up -d`,',
        'or set CORELENS_OTLP_HEALTH_URL if you exposed health on another address.',
        `Original error: ${error instanceof Error ? error.message : String(error)}`,
      ].join(' '),
    );
  }
}

function hasExportFailures(
  stats: ReturnType<ReturnType<typeof corelens>['getStats']>,
) {
  const logsFailed = stats.logs.tee?.failedExportCount ?? 0;
  const metricsFailed = stats.metrics.export.failedExportCount;
  const tracesFailed = stats.traces.snapshot.failedExportCount ?? 0;
  const logsQueued = stats.logs.tee?.currentQueueLength ?? 0;
  const tracesQueued = stats.traces.snapshot.currentQueueLength ?? 0;

  return (
    logsFailed > 0 ||
    metricsFailed > 0 ||
    tracesFailed > 0 ||
    logsQueued > 0 ||
    tracesQueued > 0
  );
}

async function main() {
  await assertCollectorIsReachable();

  const lens = corelens({
    serviceName: 'corelens-otlp-smoke',
    logs: {
      enabled: true,
      enrichWithTraceContext: true,
      timestamp: { format: 'epoch' },
    },
    metrics: {
      enabled: true,
      runtime: { enabled: false },
      maxSeriesPerMetric: 100,
    },
    traces: {
      enabled: true,
      samplingRate: 1,
    },
    diagnostics: {
      warnOnExportFailure: true,
    },
    export: {
      enabled: true,
      destination: {
        type: 'otlp-http',
        endpoint: collectorEndpoint,
        headers: {
          'x-corelens-smoke': 'true',
        },
        timeoutMs: 3_000,
      },
      batch: {
        maxQueueSize: 100,
        maxExportBatchSize: 1,
        scheduledDelayMs: 250,
        shutdownTimeoutMs: 5_000,
        fullQueuePolicy: 'drop-newest',
      },
      retry: {
        enabled: true,
        maxRetries: 2,
        initialDelayMs: 100,
        maxDelayMs: 1_000,
      },
      circuitBreaker: {
        enabled: true,
        failureThreshold: 3,
        resetTimeoutMs: 5_000,
      },
      signals: {
        logs: { enabled: true },
        metrics: { enabled: true },
        traces: { enabled: true },
      },
    },
  });

  lens.metrics
    .counter('corelens_smoke_requests_total', 'Smoke requests')
    .inc(1, {
      route: '/smoke',
      status: '200',
    });

  lens.metrics
    .histogram('corelens_smoke_duration_seconds', 'Smoke request duration', {
      buckets: [0.01, 0.05, 0.1, 0.5, 1],
    })
    .observe(0.042, { route: '/smoke' });

  lens.tracer.withSpan('corelens smoke span', () => {
    lens.logger.info('corelens smoke log', {
      route: '/smoke',
      ok: true,
    });
  });

  const result = await lens.shutdown();
  await new Promise((resolve) => setTimeout(resolve, 1_500));
  const stats = lens.getStats();

  process.stderr.write(
    `CORELENS_OTLP_SMOKE_RESULT=${JSON.stringify({
      shutdown: result,
      stats,
    })}\n`,
  );

  if (hasExportFailures(stats)) {
    process.stderr.write(
      'CORELENS_OTLP_SMOKE_STATUS=failed: one or more signals reported failed exports or retained queue items\n',
    );
    process.exitCode = 1;
    return;
  }

  process.stderr.write('CORELENS_OTLP_SMOKE_STATUS=ok\n');
}

main().catch((error) => {
  process.stderr.write(
    `${error instanceof Error ? error.stack : String(error)}\n`,
  );
  process.exitCode = 1;
});
