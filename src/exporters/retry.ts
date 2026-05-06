import { Exporter } from './types';

export class RetryingTraceExporter<
  T extends Record<string, any>,
> implements Exporter<T> {
  constructor(
    private readonly inner: Exporter<T>,
    private readonly config: {
      maxRetries?: number;
      initialDelayMs?: number;
      maxDelayMs?: number;
    },
  ) {}
  async export(spans: T[], signal?: AbortSignal): Promise<void> {
    const maxRetries = this.config.maxRetries ?? 3;
    const initialDelay = this.config.initialDelayMs ?? 100;
    const maxDelay = this.config.maxDelayMs ?? 2000;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        return await this.inner.export(spans);
      } catch (error) {
        if (attempt === maxRetries) throw error;
        if (signal?.aborted)
          throw new DOMException('Export aborted', 'AbortError');

        // Take the minimum between the current delay and the maximum delay
        const backoff = Math.min(maxDelay, initialDelay * Math.pow(2, attempt));
        const jitter = Math.random() * 0.2 * backoff;
        const delay = backoff + jitter;

        // reject immediately if signal fires mid-backoff
        await new Promise<void>((resolve, reject) => {
          if (signal?.aborted)
            return reject(new DOMException('Aborted', 'AbortError'));

          const timer = setTimeout(resolve, delay).unref();

          signal?.addEventListener(
            'abort',
            () => {
              clearTimeout(timer);
              reject(new DOMException('Aborted', 'AbortError'));
            },
            { once: true },
          );
        });
      }
    }
  }
  async shutdown?(): Promise<void> {
    await this.inner.shutdown?.();
  }
}
