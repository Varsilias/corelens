import { EventEmitter } from 'node:events';

class FakeWriteStream extends EventEmitter {
  write = jest.fn((_payload: string) => true);
  end = jest.fn((callback?: () => void) => callback?.());
}

describe('file exporter stream behavior', () => {
  afterEach(() => {
    jest.resetModules();
    jest.restoreAllMocks();
  });

  it('queues writes while the file stream is backpressured and resolves after drain', async () => {
    const stream = new FakeWriteStream();
    stream.write
      .mockReturnValueOnce(false)
      .mockReturnValueOnce(true)
      .mockReturnValueOnce(true);
    jest.doMock('node:fs', () => ({
      createWriteStream: jest.fn(() => stream),
    }));
    const { FileExporter } = await import('../../src/exporters/file');
    const exporter = new FileExporter('/tmp/corelens.log', {
      format(record: { id: string }) {
        return record.id;
      },
    });

    const first = exporter.export([{ id: 'one' }]);
    const second = exporter.export([{ id: 'two' }]);

    let firstSettled = false;
    let secondSettled = false;
    void first.then(() => {
      firstSettled = true;
    });
    void second.then(() => {
      secondSettled = true;
    });

    await Promise.resolve();
    expect(firstSettled).toBe(false);
    expect(secondSettled).toBe(false);

    stream.emit('drain');
    await Promise.all([first, second]);

    expect(firstSettled).toBe(true);
    expect(secondSettled).toBe(true);
    expect(stream.write).toHaveBeenNthCalledWith(1, 'one\n');
    expect(stream.write).toHaveBeenNthCalledWith(2, 'two\n');
  });

  it('rejects shutdown when the file stream reports an error before close completes', async () => {
    jest.spyOn(console, 'error').mockImplementation(() => {});
    const stream = new FakeWriteStream();
    stream.end.mockImplementation(() => {
      stream.emit('error', new Error('disk unavailable'));
      return stream as any;
    });
    jest.doMock('node:fs', () => ({
      createWriteStream: jest.fn(() => stream),
    }));
    const { FileExporter } = await import('../../src/exporters/file');
    const exporter = new FileExporter('/tmp/corelens.log', {
      format(record: { id: string }) {
        return record.id;
      },
    });

    await expect(exporter.shutdown()).rejects.toThrow('disk unavailable');
  });
});
