import {
  normalizeLogMessage,
  withExceptionContext,
} from '../../src/core/logger/message';

describe('normalizeLogMessage', () => {
  it.each<[unknown, string]>([
    ['plain', 'plain'],
    [{ userId: 1 }, '{"userId":1}'],
    [[1, 'a'], '[1,"a"]'],
    [42, '42'],
    [10n, '10'],
    [null, 'null'],
    [undefined, 'undefined'],
    [new TypeError('boom'), 'TypeError: boom'],
  ])('normalizes %p', (input, expected) => {
    expect(normalizeLogMessage(input)).toBe(expected);
  });

  it('falls back to String() for circular objects', () => {
    const circular: Record<string, unknown> = {};
    circular.self = circular;
    expect(normalizeLogMessage(circular)).toBe('[object Object]');
  });

  it('never throws for values without toString()', () => {
    const bare = Object.create(null);
    bare.self = bare;
    expect(normalizeLogMessage(bare)).toBe('[unserializable log message]');
  });
});

describe('withExceptionContext', () => {
  const error = new RangeError('out of range');

  it('returns exception attributes when there is no context', () => {
    expect(withExceptionContext(error)).toEqual({
      'exception.type': 'RangeError',
      'exception.message': 'out of range',
      'exception.stacktrace': error.stack,
    });
  });

  it('lets caller-supplied keys win', () => {
    expect(
      withExceptionContext(error, { 'exception.type': 'Custom', id: 1 }),
    ).toMatchObject({ 'exception.type': 'Custom', id: 1 });
  });

  it('keeps a string context under the context key', () => {
    expect(withExceptionContext(error, 'UserService')).toMatchObject({
      context: 'UserService',
      'exception.type': 'RangeError',
    });
  });

  it('omits the stacktrace when the error has none', () => {
    const bare = new Error('no stack');
    bare.stack = undefined;
    expect(withExceptionContext(bare)).not.toHaveProperty(
      'exception.stacktrace',
    );
  });
});
