import { LogsPipeline } from '../../src/core/logger/pipeline';
import { LogEvent } from '../../src/core/logger';

function event(message: string): LogEvent {
  return {
    level: 'info',
    message,
    serviceName: 'api',
    timestamp: 1,
  };
}

function formatter() {
  return {
    format(record: LogEvent) {
      return record.message;
    },
  };
}

function backpressuredWriter() {
  const drainListeners: Array<() => void> = [];
  const writer: {
    write: jest.Mock<boolean, [string?]>;
    once: jest.Mock<typeof writer, [string, () => void]>;
    drain: () => void;
  } = {
    write: jest.fn((_chunk?: string) => false),
    once: jest.fn((eventName: string, listener: () => void) => {
      if (eventName === 'drain') drainListeners.push(listener);
      return writer;
    }),
    drain() {
      const listener = drainListeners.shift();
      listener?.();
    },
  };

  return writer;
}

describe('logs pipeline', () => {
  it('drops newest queued log events when the byte queue is full', () => {
    const writer = backpressuredWriter();
    const pipeline = new LogsPipeline({
      writer: writer as any,
      maxQueueBytes: 160,
      fullQueuePolicy: 'drop-newest',
      formatter: formatter(),
    });

    pipeline.handle(event('first'));
    pipeline.handle(event('second'));
    pipeline.handle(event('third'));
    pipeline.handle(event('fourth'));

    expect(pipeline.getStats().primary).toMatchObject({
      acceptedCount: 3,
      currentQueueLength: 2,
      droppedCount: 1,
      evictedCount: 0,
    });
  });

  it('evicts oldest queued log events when the byte queue is full', () => {
    const writer = backpressuredWriter();
    const pipeline = new LogsPipeline({
      writer: writer as any,
      maxQueueBytes: 160,
      fullQueuePolicy: 'drop-oldest',
      formatter: formatter(),
    });

    pipeline.handle(event('first'));
    pipeline.handle(event('second'));
    pipeline.handle(event('third'));
    pipeline.handle(event('fourth'));

    expect(pipeline.getStats().primary).toMatchObject({
      acceptedCount: 4,
      currentQueueLength: 2,
      droppedCount: 0,
      evictedCount: 1,
    });
  });

  it('waits for writer drain during shutdown flush', async () => {
    const writer = backpressuredWriter();
    writer.write.mockReturnValueOnce(false).mockReturnValue(true);
    const pipeline = new LogsPipeline({
      writer: writer as any,
      maxQueueBytes: 1024,
      fullQueuePolicy: 'drop-newest',
      formatter: formatter(),
    });

    pipeline.handle(event('first'));
    const flush = pipeline.flushAll();

    let settled = false;
    void flush.then(() => {
      settled = true;
    });

    await Promise.resolve();
    expect(settled).toBe(false);

    writer.drain();
    await flush;

    expect(pipeline.getStats().primary).toMatchObject({
      currentQueueLength: 0,
      isDraining: false,
      drainCount: 1,
    });
  });

  it('drops a single oversized log event without queuing it', () => {
    const writer = backpressuredWriter();
    const pipeline = new LogsPipeline({
      writer: writer as any,
      maxQueueBytes: 80,
      fullQueuePolicy: 'drop-oldest',
      formatter: formatter(),
    });

    expect(pipeline.handle(event('x'.repeat(100)))).toBe(false);

    expect(pipeline.getStats().primary).toMatchObject({
      producedCount: 1,
      acceptedCount: 0,
      currentQueueLength: 0,
      droppedCount: 1,
    });
    expect(writer.write).not.toHaveBeenCalled();
  });

  it('shutdown flush is idempotent', async () => {
    const writer = backpressuredWriter();
    writer.write.mockReturnValue(true);
    const pipeline = new LogsPipeline({
      writer: writer as any,
      maxQueueBytes: 1024,
      fullQueuePolicy: 'drop-newest',
      formatter: formatter(),
    });

    pipeline.handle(event('first'));
    await pipeline.flushAll();
    await pipeline.flushAll();

    expect(pipeline.getStats().primary).toMatchObject({
      currentQueueLength: 0,
      flushedCount: 1,
    });
  });
});
