import { BatchSpanProcessor } from '../../src/core/traces/processor';
import { Span, SpanKind, TraceExporter } from '../../src/core/traces/span';

function makeProcessor(
  exporter: TraceExporter,
  fullQueuePolicy: 'drop-newest' | 'drop-oldest',
) {
  return new BatchSpanProcessor(exporter, {
    maxQueueSize: 2,
    maxExportBatchSize: 10,
    scheduledDelayMs: 60_000,
    shutdownTimeoutMs: 1_000,
    fullQueuePolicy,
    diagnostics: { warnOnExportFailure: false },
  });
}

function endSpan(processor: BatchSpanProcessor, name: string) {
  const span = new Span(
    name,
    'a'.repeat(32),
    name.padStart(16, '0').slice(-16),
    null,
    (ended) => processor.onEnd(ended),
    SpanKind.INTERNAL,
  );

  processor.onStart(span);
  span.end();
}

describe('batch span processor', () => {
  it('uses an unref timer', async () => {
    const processor = makeProcessor(
      { export: jest.fn().mockResolvedValue(undefined) },
      'drop-newest',
    );

    expect((processor as any).timer.hasRef()).toBe(false);
    await processor.shutdown();
  });

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
      endSpan(processor, `span-${i}`);
    }

    await processor.shutdown();

    expect(exported).toHaveLength(5);
  });

  it('keeps queued records and records failure stats when export fails', async () => {
    const exporter = {
      export: jest.fn().mockRejectedValue(new Error('collector unavailable')),
      shutdown: jest.fn().mockResolvedValue(undefined),
    };
    const processor = makeProcessor(exporter, 'drop-newest');

    endSpan(processor, 'span-1');

    await expect(processor.forceFlush()).rejects.toThrow(
      'collector unavailable',
    );

    expect(processor.snapshot()).toMatchObject({
      currentQueueLength: 1,
      exportedCount: 0,
      failedExportCount: 1,
      lastExportError: 'collector unavailable',
    });

    await processor.shutdown();
  });

  it('drops newest records when the queue is full and policy is drop-newest', async () => {
    const exported: string[] = [];
    const processor = makeProcessor(
      {
        async export(spans) {
          exported.push(...spans.map((span) => span.name));
        },
      },
      'drop-newest',
    );

    endSpan(processor, 'span-1');
    endSpan(processor, 'span-2');
    endSpan(processor, 'span-3');

    expect(processor.snapshot()).toMatchObject({
      currentQueueLength: 2,
      droppedCount: 1,
      backPressureHitCount: 1,
      evictedCount: 0,
    });

    await processor.forceFlush();

    expect(exported).toEqual(['span-1', 'span-2']);
    await processor.shutdown();
  });

  it('evicts oldest records when the queue is full and policy is drop-oldest', async () => {
    const exported: string[] = [];
    const processor = makeProcessor(
      {
        async export(spans) {
          exported.push(...spans.map((span) => span.name));
        },
      },
      'drop-oldest',
    );

    endSpan(processor, 'span-1');
    endSpan(processor, 'span-2');
    endSpan(processor, 'span-3');

    expect(processor.snapshot()).toMatchObject({
      currentQueueLength: 2,
      droppedCount: 0,
      backPressureHitCount: 1,
      evictedCount: 1,
    });

    await processor.forceFlush();

    expect(exported).toEqual(['span-2', 'span-3']);
    await processor.shutdown();
  });

  it('shutdown is idempotent and delegates exporter shutdown once', async () => {
    const exporter = {
      export: jest.fn().mockResolvedValue(undefined),
      shutdown: jest.fn().mockResolvedValue(undefined),
    };
    const processor = makeProcessor(exporter, 'drop-newest');

    endSpan(processor, 'span-1');
    await processor.shutdown();
    await processor.shutdown();

    expect(exporter.shutdown).toHaveBeenCalledTimes(1);
  });

  it('deduplicates concurrent forceFlush calls', async () => {
    let resolveExport: (() => void) | undefined;
    const exporter = {
      export: jest.fn(
        () =>
          new Promise<void>((resolve) => {
            resolveExport = resolve;
          }),
      ),
      shutdown: jest.fn().mockResolvedValue(undefined),
    };
    const processor = makeProcessor(exporter, 'drop-newest');

    endSpan(processor, 'span-1');
    const first = processor.forceFlush();
    const second = processor.forceFlush();

    expect(first).toBe(second);
    expect(exporter.export).toHaveBeenCalledTimes(1);

    resolveExport?.();
    await first;
    await processor.shutdown();
  });

  it('shutdown timeout aborts a hanging flush and records the failure', async () => {
    const exporter = {
      export: jest.fn(
        (_records: unknown[], signal?: AbortSignal) =>
          new Promise<void>((_resolve, reject) => {
            signal?.addEventListener('abort', () => {
              reject(new DOMException('Aborted', 'AbortError'));
            });
          }),
      ),
      shutdown: jest.fn().mockResolvedValue(undefined),
    };
    const processor = new BatchSpanProcessor(exporter, {
      maxQueueSize: 2,
      maxExportBatchSize: 10,
      scheduledDelayMs: 60_000,
      shutdownTimeoutMs: 10,
      fullQueuePolicy: 'drop-newest',
      diagnostics: { warnOnExportFailure: false },
    });

    endSpan(processor, 'span-1');
    await expect(processor.shutdown()).resolves.toBeUndefined();

    expect(processor.snapshot()).toMatchObject({
      currentQueueLength: 1,
      lastExportError: '[Corelens] trace shutdown flush timed out',
    });
    expect(exporter.shutdown).toHaveBeenCalledTimes(1);
  });

  it('does not create unhandled rejections for background flush failures', async () => {
    const unhandled = jest.fn();
    process.once('unhandledRejection', unhandled);
    const processor = new BatchSpanProcessor(
      {
        export: jest.fn().mockRejectedValue(new Error('collector unavailable')),
        shutdown: jest.fn().mockResolvedValue(undefined),
      },
      {
        maxQueueSize: 10,
        maxExportBatchSize: 1,
        scheduledDelayMs: 60_000,
        shutdownTimeoutMs: 1_000,
        fullQueuePolicy: 'drop-newest',
        diagnostics: { warnOnExportFailure: false },
      },
    );

    endSpan(processor, 'span-1');
    await new Promise((resolve) => setImmediate(resolve));

    expect(unhandled).not.toHaveBeenCalled();
    process.removeListener('unhandledRejection', unhandled);
    await processor.shutdown();
  });
});
