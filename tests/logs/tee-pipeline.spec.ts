import { LogEvent } from '../../src/core/logger';
import { diagnostics } from '../../src/core/diagnostics';
import { IPipeline } from '../../src/core/logger/pipeline';
import { TeePipeline } from '../../src/core/logger/tee-pipeline';

function event(message: string): LogEvent {
  return {
    level: 'info',
    message,
    serviceName: 'api',
    timestamp: 1,
  };
}

function primary(): IPipeline {
  return {
    handle: jest.fn(() => true),
    flushAll: jest.fn().mockResolvedValue(undefined),
    getStats: jest.fn(() => ({
      primary: {
        producedCount: 0,
        flushedCount: 0,
        backPressureHitCount: 0,
        drainCount: 0,
        maxQueueLength: 0,
        currentQueueLength: 0,
        isDraining: false,
        droppedCount: 0,
        queuedBytes: 0,
        peakQueuedBytes: 0,
        acceptedCount: 0,
        evictedCount: 0,
        softLimitHitCount: 0,
      },
    })),
  };
}

function makeTee(
  secondary: { export: jest.Mock; shutdown?: jest.Mock },
  fullQueuePolicy: 'drop-newest' | 'drop-oldest',
) {
  return new TeePipeline(primary(), secondary, {
    maxQueueSize: 2,
    maxExportBatchSize: 10,
    scheduledDelayMs: 60_000,
    shutdownTimeoutMs: 1_000,
    fullQueuePolicy,
    diagnostics: { warnOnExportFailure: false },
  });
}

describe('logs tee pipeline', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('drops newest secondary log events when the export queue is full', async () => {
    const secondary = {
      export: jest.fn().mockResolvedValue(undefined),
      shutdown: jest.fn().mockResolvedValue(undefined),
    };
    const pipeline = makeTee(secondary, 'drop-newest');

    pipeline.handle(event('one'));
    pipeline.handle(event('two'));
    pipeline.handle(event('three'));

    expect(pipeline.snapshot()).toMatchObject({
      currentQueueLength: 2,
      droppedCount: 1,
    });

    await pipeline.flushAll();
    expect(
      secondary.export.mock.calls[0][0].map((item: LogEvent) => item.message),
    ).toEqual(['one', 'two']);
  });

  it('evicts oldest secondary log events when the export queue is full', async () => {
    const secondary = {
      export: jest.fn().mockResolvedValue(undefined),
      shutdown: jest.fn().mockResolvedValue(undefined),
    };
    const pipeline = makeTee(secondary, 'drop-oldest');

    pipeline.handle(event('one'));
    pipeline.handle(event('two'));
    pipeline.handle(event('three'));

    expect(pipeline.snapshot()).toMatchObject({
      currentQueueLength: 2,
      droppedCount: 1,
    });

    await pipeline.flushAll();
    expect(
      secondary.export.mock.calls[0][0].map((item: LogEvent) => item.message),
    ).toEqual(['two', 'three']);
  });

  it('retains failed secondary exports until shutdown drops the queue', async () => {
    jest.spyOn(diagnostics, 'warn').mockImplementation(() => {});
    const secondary = {
      export: jest.fn().mockRejectedValue(new Error('sink unavailable')),
      shutdown: jest.fn().mockResolvedValue(undefined),
    };
    const pipeline = makeTee(secondary, 'drop-newest');

    pipeline.handle(event('one'));

    await expect(pipeline.forceFlush()).rejects.toThrow('sink unavailable');
    expect(pipeline.snapshot()).toMatchObject({
      currentQueueLength: 1,
      failedExportCount: 1,
      lastExportError: 'sink unavailable',
    });

    await pipeline.flushAll();
    expect(pipeline.snapshot().droppedCount).toBeGreaterThanOrEqual(1);
  });

  it('shutdown is idempotent and delegates secondary shutdown once', async () => {
    const secondary = {
      export: jest.fn().mockResolvedValue(undefined),
      shutdown: jest.fn().mockResolvedValue(undefined),
    };
    const pipeline = makeTee(secondary, 'drop-newest');

    pipeline.handle(event('one'));
    await pipeline.flushAll();
    await pipeline.flushAll();

    expect(secondary.shutdown).toHaveBeenCalledTimes(1);
  });
});
