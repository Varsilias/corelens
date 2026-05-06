import { withTimeout } from '../src/exporters/circuit-breaker';
import { RetryingTraceExporter } from '../src/exporters/retry';
import { BatchSpanProcessor } from '../src/core/traces/processor';
import { Span, SpanKind } from '../src/core/traces/span';

describe('Processor', () => {
  it('drains all trace batches during shutdown', async () => {
    const exported: unknown[] = [];
    const processor = new BatchSpanProcessor(
      {
        async export(spans) {
          exported.push(...spans);
        },
      },
      {
        maxQueueSize: 10,
        maxExportBatchSize: 2,
        scheduledDelayMs: 60_000,
        shutdownTimeoutMs: 5_000,
        fullQueuePolicy: 'drop-newest',
      },
    );

    for (let i = 0; i < 5; i++) {
      const span = new Span(
        `span-${i}`,
        'a'.repeat(32),
        i.toString().padStart(16, '0'),
        null,
        (s) => processor.onEnd(s),
        SpanKind.INTERNAL,
      );
      processor.onStart(span);
      span.end();
    }

    await processor.shutdown();

    expect(exported).toHaveLength(5);
  });

  it('aborts retry backoff when shutdown timeout wins', async () => {
    let attempts = 0;
    const controller = new AbortController();
    const exporter = new RetryingTraceExporter(
      {
        async export() {
          attempts++;
          throw new Error('export failed');
        },
      },
      {
        maxRetries: 10,
        initialDelayMs: 1_000,
        maxDelayMs: 1_000,
      },
    );

    await expect(
      withTimeout(
        exporter.export([{}], controller.signal),
        10,
        'shutdown timeout',
        controller,
      ),
    ).rejects.toThrow('shutdown timeout');

    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(attempts).toBe(1);
  });
});
