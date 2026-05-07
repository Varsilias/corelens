import { diagnostics } from '../../src/core/diagnostics';
import { BatchSpanProcessor } from '../../src/core/traces/processor';
import { Span, SpanKind } from '../../src/core/traces/span';

function endSpan(processor: BatchSpanProcessor) {
  const span = new Span(
    'operation',
    'a'.repeat(32),
    'b'.repeat(16),
    null,
    (ended) => processor.onEnd(ended),
    SpanKind.INTERNAL,
  );

  processor.onStart(span);
  span.end();
}

describe('corelens diagnostics', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('writes warnings when warnOnExportFailure is enabled', async () => {
    const warn = jest.spyOn(diagnostics, 'warn').mockImplementation(() => {});
    const processor = new BatchSpanProcessor(
      {
        export: jest.fn().mockRejectedValue(new Error('collector unavailable')),
      },
      {
        maxQueueSize: 10,
        maxExportBatchSize: 1,
        scheduledDelayMs: 60_000,
        shutdownTimeoutMs: 1_000,
        fullQueuePolicy: 'drop-newest',
        diagnostics: { warnOnExportFailure: true },
      },
    );

    endSpan(processor);
    await new Promise((resolve) => setImmediate(resolve));

    expect(warn).toHaveBeenCalledWith(
      '[Corelens] Trace export failed: collector unavailable\n',
    );

    await processor.shutdown();
  });

  it('suppresses warnings when warnOnExportFailure is disabled', async () => {
    const warn = jest.spyOn(diagnostics, 'warn').mockImplementation(() => {});
    const processor = new BatchSpanProcessor(
      {
        export: jest.fn().mockRejectedValue(new Error('collector unavailable')),
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

    endSpan(processor);
    await new Promise((resolve) => setImmediate(resolve));

    expect(warn).not.toHaveBeenCalled();

    await processor.shutdown();
  });
});
