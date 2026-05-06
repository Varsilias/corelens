import { Exporter } from './types';

enum CircuitState {
  CLOSED,
  OPEN,
  HALF_OPEN,
}

export class CircuitBreakerExporter<
  T extends Record<string, any>,
> implements Exporter<T> {
  private state = CircuitState.CLOSED;
  private failureCount = 0;
  private lastFailureTime = 0;

  constructor(
    private readonly inner: Exporter<T>,
    private config: {
      threshold: number;
      resetTimeoutMs: number;
    },
  ) {}

  async export(spans: T[], signal?: AbortSignal): Promise<void> {
    if (this.state === CircuitState.OPEN) {
      if (Date.now() - this.lastFailureTime > this.config.resetTimeoutMs) {
        this.state = CircuitState.HALF_OPEN;
      } else {
        throw new Error('CircuitBreaker: Circuit is OPEN, failing fast.');
      }
    }

    try {
      await this.inner.export(spans, signal);
      this.onSuccess();
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }

  private onSuccess() {
    this.failureCount = 0;
    this.state = CircuitState.CLOSED;
  }

  private onFailure() {
    this.failureCount++;
    this.lastFailureTime = Date.now();
    if (this.failureCount >= this.config.threshold) {
      this.state = CircuitState.OPEN;
    }
  }

  async shutdown(): Promise<void> {
    await this.inner.shutdown?.();
  }
}

export function withTimeout<T>(
  promise: Promise<T>,
  ms: number,
  message: string,
  signal?: AbortController, // optional signal to cancel the upstream work
): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      signal?.abort();
      reject(new Error(message));
    }, ms).unref();

    promise.then(
      (value) => {
        clearTimeout(timer); // clean up the timer when the upstream promise wins
        resolve(value);
      },
      (error) => {
        clearTimeout(timer);
        reject(error);
      },
    );
  });
}
