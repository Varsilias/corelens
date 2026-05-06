import { SignalFormatter } from '../core';
import { OtlpHttpTransport } from '../otlp/transport';
import { OTLPSignalRequest } from '../otlp/types';
import { Exporter } from './types';

export class OtlpHttpExporter<
  T,
  R extends OTLPSignalRequest,
> implements Exporter<T> {
  private readonly transport: OtlpHttpTransport;

  constructor(
    private readonly config: {
      endpoint: string;
      headers?: Record<string, string>;
      timeoutMs?: number;
    },
    private readonly formatter: SignalFormatter<T, R>,
  ) {
    this.transport = new OtlpHttpTransport({
      endpoint: config.endpoint,
      headers: config.headers,
      timeoutMs: config.timeoutMs,
    });
  }
  async export(spans: T[], signal?: AbortSignal): Promise<void> {
    if (spans.length === 0) return;

    await this.transport.postJson(this.formatter.format(spans), signal);
  }
  async shutdown?(): Promise<void> {}
}
