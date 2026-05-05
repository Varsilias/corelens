import { OTLPSignalRequest } from './types';

type OtlpHttpTransportConfig = {
  endpoint: string;
  headers?: Record<string, string>;
  timeoutMs?: number;
};

export class OtlpHttpTransport {
  constructor(private readonly config: OtlpHttpTransportConfig) {}

  async postJson(body: OTLPSignalRequest): Promise<void> {
    const controller = new AbortController();
    const timeout = setTimeout(
      () => controller.abort(),
      this.config.timeoutMs ?? 10_000,
    );

    try {
      const res = await fetch(this.config.endpoint, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          ...this.config.headers,
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      });

      if (!res.ok) {
        const text = await res.text().catch(() => '');
        throw new Error(
          `OTLP HTTP export failed: ${res.status} ${res.statusText} ${text}`,
        );
      }
    } finally {
      clearTimeout(timeout);
    }
  }
}
