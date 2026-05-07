import { RetryingTraceExporter } from '../../src/exporters/retry';

describe('retry exporter', () => {
  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  it('retries failed exports and stops after the first success', async () => {
    const exportMock = jest
      .fn()
      .mockRejectedValueOnce(new Error('first failure'))
      .mockRejectedValueOnce(new Error('second failure'))
      .mockResolvedValueOnce(undefined);
    const exporter = new RetryingTraceExporter(
      { export: exportMock },
      { maxRetries: 3, initialDelayMs: 1, maxDelayMs: 1 },
    );

    jest.spyOn(Math, 'random').mockReturnValue(0);

    await expect(exporter.export([{ id: 'span-1' }])).resolves.toBeUndefined();

    expect(exportMock).toHaveBeenCalledTimes(3);
  });

  it('throws the final export error after retries are exhausted', async () => {
    const exportMock = jest.fn().mockRejectedValue(new Error('still failing'));
    const exporter = new RetryingTraceExporter(
      { export: exportMock },
      { maxRetries: 2, initialDelayMs: 1, maxDelayMs: 1 },
    );

    jest.spyOn(Math, 'random').mockReturnValue(0);

    await expect(exporter.export([{ id: 'span-1' }])).rejects.toThrow(
      'still failing',
    );
    expect(exportMock).toHaveBeenCalledTimes(3);
  });

  it('uses exponential backoff capped by maxDelayMs with jitter', async () => {
    jest.useFakeTimers();
    jest.spyOn(Math, 'random').mockReturnValue(0.5);
    const exportMock = jest
      .fn()
      .mockRejectedValueOnce(new Error('one'))
      .mockRejectedValueOnce(new Error('two'))
      .mockRejectedValueOnce(new Error('three'))
      .mockResolvedValueOnce(undefined);
    const exporter = new RetryingTraceExporter(
      { export: exportMock },
      { maxRetries: 3, initialDelayMs: 100, maxDelayMs: 250 },
    );

    const result = exporter.export([{ id: 'span-1' }]);
    await Promise.resolve();
    expect(exportMock).toHaveBeenCalledTimes(1);

    await jest.advanceTimersByTimeAsync(110);
    expect(exportMock).toHaveBeenCalledTimes(2);

    await jest.advanceTimersByTimeAsync(220);
    expect(exportMock).toHaveBeenCalledTimes(3);

    await jest.advanceTimersByTimeAsync(275);
    await expect(result).resolves.toBeUndefined();
    expect(exportMock).toHaveBeenCalledTimes(4);
  });

  it('aborts retry backoff without making another export attempt', async () => {
    const controller = new AbortController();
    const exportMock = jest.fn().mockRejectedValue(new Error('failed'));
    const exporter = new RetryingTraceExporter(
      { export: exportMock },
      { maxRetries: 10, initialDelayMs: 1_000, maxDelayMs: 1_000 },
    );

    const result = exporter.export([{ id: 'span-1' }], controller.signal);
    await new Promise((resolve) => setImmediate(resolve));
    controller.abort();

    await expect(result).rejects.toThrow('Aborted');
    expect(exportMock).toHaveBeenCalledTimes(1);
  });

  it('delegates shutdown to the wrapped exporter', async () => {
    const shutdown = jest.fn().mockResolvedValue(undefined);
    const exporter = new RetryingTraceExporter(
      { export: jest.fn(), shutdown },
      { maxRetries: 1, initialDelayMs: 1, maxDelayMs: 1 },
    );

    await exporter.shutdown?.();

    expect(shutdown).toHaveBeenCalledTimes(1);
  });
});
