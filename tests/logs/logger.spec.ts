import { normaliseCorelensConfig } from '../../src/core/config/root.config';
import { Logger } from '../../src/core/logger';
import { IPipeline } from '../../src/core/logger/pipeline';
import { TraceContext } from '../../src/core/traces';

function pipeline() {
  const events: unknown[] = [];
  const p: IPipeline = {
    handle: jest.fn((event) => {
      events.push(event);
      return true;
    }),
    flushAll: jest.fn().mockResolvedValue(undefined),
    getStats: jest.fn(() => ({
      primary: {
        producedCount: 0,
        flushedCount: 0,
        backPressureHitCount: 0,
        drainCount: 0,
        maxQueueLength: 0,
        currentQueueLength: 0,
        isDraining: false,
        droppedCount: 0,
        queuedBytes: 0,
        peakQueuedBytes: 0,
        acceptedCount: 0,
        evictedCount: 0,
        softLimitHitCount: 0,
      },
    })),
  };

  return { pipeline: p, events };
}

function config(overrides: Record<string, any> = {}) {
  return normaliseCorelensConfig({
    serviceName: 'api',
    logs: {
      enabled: true,
      level: 'info',
      timestamp: { format: 'epoch' },
      enrichWithTraceContext: true,
      ...overrides,
    },
  });
}

describe('logger', () => {
  it('enriches logs only when trace context exists', () => {
    const { pipeline: p, events } = pipeline();
    const context: TraceContext = {
      traceId: 'a'.repeat(32),
      spanId: 'b'.repeat(16),
      parentSpanId: null,
      sampled: true,
    };
    const logger = new Logger(config(), p, {
      getTraceContext: () => context,
    });

    logger.info('inside span', { route: '/users' });

    expect(events[0]).toMatchObject({
      level: 'info',
      message: 'inside span',
      serviceName: 'api',
      context: { route: '/users' },
      traceId: 'a'.repeat(32),
      spanId: 'b'.repeat(16),
    });
  });

  it('does not attach undefined trace fields when no trace context exists', () => {
    const { pipeline: p, events } = pipeline();
    const logger = new Logger(config(), p, {
      getTraceContext: () => undefined,
    });

    logger.info('outside span');

    expect(Object.prototype.hasOwnProperty.call(events[0], 'traceId')).toBe(
      false,
    );
    expect(Object.prototype.hasOwnProperty.call(events[0], 'spanId')).toBe(
      false,
    );
  });

  it('respects configured log level thresholds', () => {
    const { pipeline: p } = pipeline();
    const logger = new Logger(config({ level: 'warn' }), p);

    logger.debug('debug');
    logger.info('info');
    logger.warn('warn');
    logger.error('error');

    expect(p.handle).toHaveBeenCalledTimes(2);
    expect(
      (p.handle as jest.Mock).mock.calls.map(([event]) => event.level),
    ).toEqual(['warn', 'error']);
  });
});
