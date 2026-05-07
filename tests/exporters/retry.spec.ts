import { RetryingTraceExporter } from '../../src/exporters/retry';

describe('retry exporter', () => {
  afterEach(() => {
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
