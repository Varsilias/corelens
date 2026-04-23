import { Writable } from 'node:stream';
import { LogEvent } from '../modules';
import { FullQueuePolicy } from './config';

type QueueItem = {
  event: LogEvent;
  estimatedPayloadBytes: number;
};

type PipelineConfig = {
  writer: Writable;
  maxQueueBytes: number;
  fullQueuePolicy: FullQueuePolicy;
};

type PipelineStats = {
  producedCount: number;
  flushedCount: number;
  backPressureHitCount: number;
  drainCount: number;
  maxQueueLength: number;
  currentQueueLength: number;
  isDraining: boolean;
  droppedCount: number;
  queuedBytes: number;
  peakQueuedBytes: number;
  acceptedCount: number;
  evictedCount: number;
  softLimitHitCount: number;
};

export interface IPipeline {
  handle(event: LogEvent): boolean;
  flushAll(): Promise<void>;
}

export class LogsPipeline implements IPipeline {
  private producedCount = 0;
  private flushedCount = 0;
  private backPressureHitCount = 0;
  private drainCount = 0;
  private maxQueueLength = 0;
  private acceptedCount = 0;
  private isDraining: boolean = false;
  private evictedCount = 0;

  private queue: QueueItem[] = [];
  private droppedCount = 0;
  private queuedBytes = 0;
  private peakQueuedBytes = 0;

  private isShuttingDown = false;
  private flushWaiters: Array<() => void> = [];

  private softMaxQueueBytes: number;
  private hardMaxQueueBytes: number;
  private fullQueuePolicy: FullQueuePolicy = 'drop-newest'; // default to drop-newest
  private softLimitHitCount = 0;

  constructor(private config: PipelineConfig) {
    this.fullQueuePolicy = config.fullQueuePolicy;
    this.hardMaxQueueBytes = config.maxQueueBytes;
    this.softMaxQueueBytes = Math.floor(config.maxQueueBytes * 0.8);
  }

  handle(event: LogEvent): boolean {
    // 1. Total attempts (The "Traffic" metric)
    this.producedCount++;

    // if the process has been killed
    // isShuttingDown will be true, we should no longer
    // enqueue logs and allow the internal buffer to drain
    if (this.isShuttingDown) {
      this.droppedCount++;
      return false;
    }

    const payloadSize = this.estimateSize(event);

    if (payloadSize + this.queuedBytes > this.hardMaxQueueBytes) {
      if (this.fullQueuePolicy === 'drop-newest') {
        this.droppedCount++;
        return false;
      }

      if (this.fullQueuePolicy === 'drop-oldest') {
        this.makeRoom(payloadSize);
        // If after making room it still doesn't fit (event too big), drop it
        if (payloadSize + this.queuedBytes > this.hardMaxQueueBytes) {
          this.droppedCount++;
          return false;
        }
      }
    }

    if (this.queuedBytes > this.softMaxQueueBytes) {
      this.softLimitHitCount++;
    }

    this.enqueue(event, payloadSize);
    return true;
  }

  private enqueue(event: LogEvent, payloadSize: number) {
    this.acceptedCount++;
    this.queue.push({ estimatedPayloadBytes: payloadSize, event });

    this.queuedBytes += payloadSize;
    this.peakQueuedBytes = Math.max(this.peakQueuedBytes, this.queuedBytes);
    this.maxQueueLength = Math.max(this.maxQueueLength, this.queue.length);

    this.flush();
  }

  getStats(): PipelineStats {
    return {
      producedCount: this.producedCount,
      flushedCount: this.flushedCount,
      backPressureHitCount: this.backPressureHitCount,
      drainCount: this.drainCount,
      maxQueueLength: this.maxQueueLength,
      currentQueueLength: this.queue.length,
      isDraining: this.isDraining,
      peakQueuedBytes: this.peakQueuedBytes,
      queuedBytes: this.queuedBytes,
      droppedCount: this.droppedCount,
      acceptedCount: this.acceptedCount,
      evictedCount: this.evictedCount,
      softLimitHitCount: this.softLimitHitCount,
    };
  }

  async flushAll(): Promise<void> {
    this.isShuttingDown = true;
    if (this.queue.length === 0 && !this.isDraining) {
      return;
    }

    return new Promise((resolve) => {
      this.flushWaiters.push(resolve);
      this.flush();
    });
  }

  private flush() {
    if (this.isDraining) return;

    while (this.queue.length > 0) {
      const chunk = this.queue[0];
      const payload = JSON.stringify(chunk.event) + '\n';

      const ok = this.config.writer.write(payload);

      if (!ok) {
        this.backPressureHitCount++;
        this.isDraining = true;
        this.config.writer.once('drain', () => {
          this.drainCount++;
          this.isDraining = false;
          this.flush();
          this.resolveFlushWaitersIfIdle();
        });

        return;
      }

      this.queue.shift();
      this.queuedBytes -= chunk.estimatedPayloadBytes;
      this.flushedCount++;
    }

    this.resolveFlushWaitersIfIdle();
  }

  private resolveFlushWaitersIfIdle() {
    if (this.queue.length === 0 && !this.isDraining) {
      const waiters = this.flushWaiters;
      this.flushWaiters = [];
      for (const resolve of waiters) resolve();
    }
  }

  private estimateSize(event: LogEvent) {
    return (
      64 + event.message.length + JSON.stringify(event.context ?? {}).length
    );
  }

  private makeRoom(bytesNeeded: number) {
    // We need to free up enough space so that (queuedBytes + bytesNeeded) <= maxQueueBytes
    while (
      this.queuedBytes + bytesNeeded > this.hardMaxQueueBytes &&
      this.queue.length > 0
    ) {
      const oldest = this.queue.shift();
      if (oldest) {
        this.queuedBytes -= oldest.estimatedPayloadBytes;
        this.evictedCount++;
      }
    }
  }
}

export class NoopPipeline implements IPipeline {
  handle(event: LogEvent): boolean {
    return true;
  }
  async flushAll(): Promise<void> {}
}
