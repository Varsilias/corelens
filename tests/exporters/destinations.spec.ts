import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { ConsoleExporter } from '../../src/exporters/console';
import { FileExporter } from '../../src/exporters/file';

const formatter = {
  format(record: { id: string }) {
    return JSON.stringify(record);
  },
};

describe('destination exporters', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('console exporter writes every log record and waits for stdout drain', async () => {
    const written: string[] = [];
    const write = jest
      .spyOn(process.stdout, 'write')
      .mockImplementation((chunk: any) => {
        written.push(String(chunk));
        setImmediate(() => process.stdout.emit('drain'));
        return false;
      });
    const exporter = new ConsoleExporter('logs', formatter);

    await exporter.export([{ id: '1' }, { id: '2' }]);

    expect(write).toHaveBeenCalledTimes(2);
    expect(written).toEqual(['{"id":"1"}\n', '{"id":"2"}\n']);
  });

  it('console exporter bounds non-log records and reports skipped records', async () => {
    const stdout: string[] = [];
    const stderr: string[] = [];
    jest.spyOn(process.stdout, 'write').mockImplementation((chunk: any) => {
      stdout.push(String(chunk));
      return true;
    });
    jest.spyOn(process.stderr, 'write').mockImplementation((chunk: any) => {
      stderr.push(String(chunk));
      return true;
    });
    const exporter = new ConsoleExporter('traces', formatter, true, 2);

    await exporter.export([{ id: '1' }, { id: '2' }, { id: '3' }]);

    expect(stdout).toEqual(['{"id":"2"}\n', '{"id":"3"}\n']);
    expect(stderr).toEqual(['[Corelens] ConsoleExporter skipped 1 traces\n']);
  });

  it('file exporter appends formatted records and closes cleanly on shutdown', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'corelens-exporter-'));
    const filePath = join(dir, 'records.log');
    const exporter = new FileExporter(filePath, formatter);

    try {
      await exporter.export([{ id: '1' }, { id: '2' }]);
      await exporter.shutdown();

      await expect(readFile(filePath, 'utf8')).resolves.toBe(
        '{"id":"1"}\n{"id":"2"}\n',
      );
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
});
