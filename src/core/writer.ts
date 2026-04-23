import { Writable } from 'node:stream';

export class CorelensWriter extends Writable {
  constructor(private writerConfig: { highWaterMark: number }) {
    super({ highWaterMark: writerConfig.highWaterMark ?? 64 * 1024 });
  }

  _write(
    chunk: Buffer,
    encoding: BufferEncoding,
    callback: (error?: Error | null) => void,
  ) {
    process.stdout.write(chunk, encoding, callback);
  }
}
