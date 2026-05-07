import { OtlpHttpExporter } from '../../src/exporters/otlp-http';
import { OTLPSignalRequest } from '../../src/otlp/types';

const otlpPayload = {
  resourceSpans: [
    {
      resource: { attributes: [] },
      scopeSpans: [],
    },
  ],
} satisfies OTLPSignalRequest;

describe('otlp http exporter', () => {
  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  it('posts formatted payloads with json content type and custom headers', async () => {
    const fetchMock = jest
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(new Response('', { status: 200 }));
    const formatter = {
      format(records: Array<{ id: string }>) {
        return {
          resourceSpans: [
            {
              resource: {
                attributes: [
                  {
                    key: 'record.count',
                    value: { doubleValue: records.length },
                  },
                ],
              },
              scopeSpans: [],
            },
          ],
        } satisfies OTLPSignalRequest;
      },
    };
    const exporter = new OtlpHttpExporter(
      {
        endpoint: 'http://collector:4318/v1/traces',
        headers: { authorization: 'Bearer token' },
        timeoutMs: 500,
      },
      formatter,
    );

    await exporter.export([{ id: 'span-1' }]);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith(
      'http://collector:4318/v1/traces',
      expect.objectContaining({
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          authorization: 'Bearer token',
        },
        body: JSON.stringify({
          resourceSpans: [
            {
              resource: {
                attributes: [
                  { key: 'record.count', value: { doubleValue: 1 } },
                ],
              },
              scopeSpans: [],
            },
          ],
        }),
      }),
    );
  });

  it('does not call the transport for empty batches', async () => {
    const fetchMock = jest.spyOn(globalThis, 'fetch');
    const exporter = new OtlpHttpExporter(
      { endpoint: 'http://collector:4318/v1/traces' },
      { format: () => ({ resourceSpans: [] }) as OTLPSignalRequest },
    );

    await exporter.export([]);

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('treats non-2xx responses as export failures', async () => {
    jest.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response('collector rejected payload', {
        status: 503,
        statusText: 'Service Unavailable',
      }),
    );
    const exporter = new OtlpHttpExporter(
      { endpoint: 'http://collector:4318/v1/traces' },
      { format: () => otlpPayload },
    );

    await expect(exporter.export([{ id: 'span-1' }])).rejects.toThrow(
      'OTLP HTTP export failed: 503 Service Unavailable collector rejected payload',
    );
  });

  it('aborts the request when timeoutMs expires', async () => {
    jest.useFakeTimers();
    const fetchMock = jest
      .spyOn(globalThis, 'fetch')
      .mockImplementation((_url, init) => {
        return new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () => {
            reject(new DOMException('The operation was aborted', 'AbortError'));
          });
        });
      });
    const exporter = new OtlpHttpExporter(
      { endpoint: 'http://collector:4318/v1/traces', timeoutMs: 50 },
      { format: () => otlpPayload },
    );

    const result = exporter.export([{ id: 'span-1' }]);
    const rejection = expect(result).rejects.toThrow(
      'The operation was aborted',
    );

    await jest.advanceTimersByTimeAsync(50);

    await rejection;
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('propagates an external abort signal to fetch', async () => {
    const controller = new AbortController();
    let observedSignal: AbortSignal | undefined;
    jest.spyOn(globalThis, 'fetch').mockImplementation((_url, init) => {
      observedSignal = init?.signal ?? undefined;
      return new Promise<Response>((_resolve, reject) => {
        init?.signal?.addEventListener('abort', () => {
          reject(new DOMException('The operation was aborted', 'AbortError'));
        });
      });
    });
    const exporter = new OtlpHttpExporter(
      { endpoint: 'http://collector:4318/v1/traces', timeoutMs: 10_000 },
      { format: () => otlpPayload },
    );

    const result = exporter.export([{ id: 'span-1' }], controller.signal);
    controller.abort();

    await expect(result).rejects.toThrow('The operation was aborted');
    expect(observedSignal?.aborted).toBe(true);
  });
});
