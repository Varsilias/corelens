import { BatchSpanProcessor } from '../../src/core/traces/processor';
import { Span, SpanKind } from '../../src/core/traces/span';
import { TraceExporter } from '../../src/core/traces/span';

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

describe('batch export queue', () => {
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
});
