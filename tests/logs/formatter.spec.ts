import {
  LogsConsoleFormatter,
  LogsOtlpFormatter,
} from '../../src/core/logger/formatter';
import { LogEvent } from '../../src/core/logger';

function event(overrides: Partial<LogEvent> = {}): LogEvent {
  return {
    level: 'info',
    message: 'user created',
    serviceName: 'api',
    timestamp: 1_700_000_000_000,
    context: {
      route: '/users',
      retry: 2,
      cached: false,
    },
    ...overrides,
  };
}

describe('log formatters', () => {
  it('json formatter omits absent trace fields', () => {
    const formatted = new LogsConsoleFormatter({
      prettyEnabled: false,
      colorize: false,
    }).format(event());

    expect(JSON.parse(formatted)).not.toHaveProperty('traceId');
    expect(JSON.parse(formatted)).not.toHaveProperty('spanId');
  });

  it('pretty formatter includes message and context without color by default', () => {
    const formatted = new LogsConsoleFormatter({
      prettyEnabled: true,
      colorize: false,
    }).format(event());

    expect(formatted).toContain('[1700000000000] INFO : user created');
    expect(formatted).toContain('"route": "/users"');
    expect(formatted).not.toContain('\x1b[');
  });

  it('otlp formatter maps severity, timestamp, context attributes, and trace correlation fields', () => {
    jest.spyOn(Date, 'now').mockReturnValue(1_700_000_000_010);
    const formatted = new LogsOtlpFormatter({
      serviceName: 'api',
      version: '1.0.0',
    }).format([
      event({
        level: 'error',
        traceId: 'a'.repeat(32),
        spanId: 'b'.repeat(16),
      }),
    ]);
    const record = formatted.resourceLogs[0].scopeLogs[0].logRecords[0];

    expect(formatted.resourceLogs[0].resource.attributes).toContainEqual({
      key: 'service.name',
      value: { stringValue: 'api' },
    });
    expect(record).toMatchObject({
      timeUnixNano: '1700000000010000000',
      observedTimeUnixNano: '1700000000000000000',
      severityNumber: 17,
      severityText: 'ERROR',
      body: { stringValue: 'user created' },
      traceId: 'A'.repeat(32),
      spanId: 'B'.repeat(16),
    });
    expect(record.attributes).toEqual(
      expect.arrayContaining([
        { key: 'route', value: { stringValue: '/users' } },
        { key: 'retry', value: { intValue: '2' } },
        { key: 'cached', value: { boolValue: false } },
      ]),
    );
  });

  it('otlp formatter omits trace correlation fields when no trace context exists', () => {
    const record = new LogsOtlpFormatter({
      serviceName: 'api',
      version: '1.0.0',
    }).format([event()]).resourceLogs[0].scopeLogs[0].logRecords[0];

    expect(record).not.toHaveProperty('traceId');
    expect(record).not.toHaveProperty('spanId');
  });
});
