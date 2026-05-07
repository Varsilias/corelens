import { LogEvent } from '.';
import {
  labelsToAttributes,
  OTLPLogRecord,
  OTLPLogsRequest,
  SEVERITY_NUMBER,
} from '../../otlp/types';
import { SignalFormatter } from '../config/types';

type TextFormatConfig = {
  prettyEnabled: boolean;
  colorize: boolean;
};

const DEFAULT_TEXT_FORMAT_CONFIG: TextFormatConfig = {
  prettyEnabled: false,
  colorize: false,
};

function formatLogEventAsText(
  event: LogEvent,
  config: TextFormatConfig,
): string {
  if (!config.prettyEnabled) {
    return JSON.stringify(event);
  }

  const color = config.colorize ? getLevelColor(event.level) : '';
  const reset = config.colorize ? '\x1b[0m' : '';
  const level = event.level.toUpperCase().padEnd(5);
  let output = `${color}[${event.timestamp}] ${level}: ${event.message}${reset}`;

  if (event.context && Object.keys(event.context).length > 0) {
    output += `\n${JSON.stringify(event.context, null, 2)}`;
  }

  return output;
}

function getLevelColor(level: string): string {
  switch (level) {
    case 'info':
      return '\x1b[32m'; // Green
    case 'warn':
      return '\x1b[33m'; // Yellow
    case 'error':
      return '\x1b[31m'; // Red
    case 'debug':
      return '\x1b[36m'; // Cyan
    default:
      return '\x1b[37m'; // White
  }
}

export class LogsConsoleFormatter implements SignalFormatter<LogEvent, string> {
  constructor(
    private readonly config: TextFormatConfig = DEFAULT_TEXT_FORMAT_CONFIG,
  ) {}

  format(event: LogEvent): string {
    return formatLogEventAsText(event, this.config);
  }
}

export class LogsFileFormatter implements SignalFormatter<LogEvent, string> {
  constructor(
    private readonly config: TextFormatConfig = DEFAULT_TEXT_FORMAT_CONFIG,
  ) {}

  format(event: LogEvent): string {
    return formatLogEventAsText(event, this.config);
  }
}

export class LogsOtlpFormatter implements SignalFormatter<
  LogEvent,
  OTLPLogsRequest
> {
  constructor(
    private readonly config: { serviceName: string; version: string },
  ) {}

  format(events: LogEvent[]): OTLPLogsRequest {
    return {
      resourceLogs: [
        {
          resource: {
            attributes: [
              {
                key: 'service.name',
                value: { stringValue: this.config.serviceName },
              },
            ],
          },
          scopeLogs: [
            {
              scope: { name: 'corelens', version: this.config.version },
              logRecords: events.map((e) => this.formatRecord(e)),
            },
          ],
        },
      ],
    };
  }

  private formatRecord(event: LogEvent): OTLPLogRecord {
    const timeNano = (BigInt(Date.now()) * 1_000_000n).toString();
    const observedTimeNano = this.toUnixNano(event.timestamp);

    const record: OTLPLogRecord = {
      timeUnixNano: timeNano,
      observedTimeUnixNano: observedTimeNano,
      severityNumber: SEVERITY_NUMBER[event.level] ?? 9,
      severityText: event.level.toUpperCase(),
      body: { stringValue: event.message },
      attributes: labelsToAttributes(event.context),
    };

    // Propagate trace context if the log was emitted inside a span.
    // OTLP collectors use these to correlate logs with traces in the UI.
    if (event.traceId) record.traceId = event.traceId.toUpperCase();
    if (event.spanId) record.spanId = event.spanId.toUpperCase();

    return record;
  }

  private toUnixNano(timestamp: number | string): string {
    const epochMs =
      typeof timestamp === 'number' ? timestamp : new Date(timestamp).getTime();

    return (BigInt(epochMs) * 1_000_000n).toString();
  }
}
