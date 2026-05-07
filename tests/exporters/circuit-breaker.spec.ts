import { CircuitBreakerExporter } from '../../src/exporters/circuit-breaker';

describe('circuit breaker exporter', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('opens after the configured failure threshold and fails fast', async () => {
    const exportMock = jest
      .fn()
      .mockRejectedValue(new Error('downstream down'));
    const exporter = new CircuitBreakerExporter(
      { export: exportMock },
      { threshold: 2, resetTimeoutMs: 1_000 },
    );

    jest.spyOn(Date, 'now').mockReturnValue(1_000);

    await expect(exporter.export([{ id: 'span-1' }])).rejects.toThrow(
      'downstream down',
    );
    await expect(exporter.export([{ id: 'span-2' }])).rejects.toThrow(
      'downstream down',
    );
    await expect(exporter.export([{ id: 'span-3' }])).rejects.toThrow(
      'CircuitBreaker: Circuit is OPEN',
    );

    expect(exportMock).toHaveBeenCalledTimes(2);
  });

  it('moves to half-open after reset timeout and closes after a successful trial', async () => {
    const exportMock = jest
      .fn()
      .mockRejectedValueOnce(new Error('downstream down'))
      .mockResolvedValue(undefined);
    const exporter = new CircuitBreakerExporter(
      { export: exportMock },
      { threshold: 1, resetTimeoutMs: 1_000 },
    );
    const now = jest.spyOn(Date, 'now');

    now.mockReturnValue(1_000);
    await expect(exporter.export([{ id: 'span-1' }])).rejects.toThrow(
      'downstream down',
    );

    now.mockReturnValue(2_001);
    await expect(exporter.export([{ id: 'span-2' }])).resolves.toBeUndefined();
    await expect(exporter.export([{ id: 'span-3' }])).resolves.toBeUndefined();

    expect(exportMock).toHaveBeenCalledTimes(3);
  });

  it('delegates shutdown to the wrapped exporter', async () => {
    const shutdown = jest.fn().mockResolvedValue(undefined);
    const exporter = new CircuitBreakerExporter(
      { export: jest.fn(), shutdown },
      { threshold: 1, resetTimeoutMs: 1_000 },
    );

    await exporter.shutdown();

    expect(shutdown).toHaveBeenCalledTimes(1);
  });
});
