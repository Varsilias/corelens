import 'reflect-metadata';
import { ExecutionContext, Type } from '@nestjs/common';
import { PATH_METADATA } from '@nestjs/common/constants';
import { lastValueFrom, of } from 'rxjs';

import { CorelensHttpInterceptor } from '../../src/adapter/nest/interceptor';

class RootController {
  getRoot() {
    return undefined;
  }

  getMetrics() {
    return undefined;
  }
}

class UsersController {
  getUser() {
    return undefined;
  }
}

Reflect.defineMetadata(PATH_METADATA, '/', RootController);
Reflect.defineMetadata(PATH_METADATA, '/', RootController.prototype.getRoot);
Reflect.defineMetadata(
  PATH_METADATA,
  '/metrics',
  RootController.prototype.getMetrics,
);
Reflect.defineMetadata(PATH_METADATA, 'users', UsersController);
Reflect.defineMetadata(PATH_METADATA, ':id', UsersController.prototype.getUser);

function createHttpContext({
  controller,
  handler,
  path,
  status = 200,
}: {
  controller: Type<unknown>;
  handler: (...args: never[]) => unknown;
  path: string;
  status?: number;
}): ExecutionContext {
  const req = {
    method: 'GET',
    path,
    url: path,
    originalUrl: path,
    protocol: 'http',
    headers: {},
  };
  const res = { statusCode: status };

  return {
    getType: () => 'http',
    getClass: () => controller,
    getHandler: () => handler,
    switchToHttp: () => ({
      getRequest: () => req,
      getResponse: () => res,
    }),
  } as unknown as ExecutionContext;
}

function createInterceptor(
  options: { span?: ReturnType<typeof createSpan> } = {},
) {
  const span = Object.prototype.hasOwnProperty.call(options, 'span')
    ? options.span
    : createSpan();
  const lens = {
    httpTracingRecorder: {
      isEnabled: true,
      start: jest.fn(() => span),
      end: jest.fn(),
    },
    httpMetricsRecorder: {
      isEnabled: true,
      record: jest.fn(),
    },
    tracer: {
      enterWithSpan: jest.fn(),
    },
  };

  return {
    lens,
    interceptor: new CorelensHttpInterceptor(lens as any),
  };
}

function createSpan() {
  return {
    setAttribute: jest.fn(),
    setStatus: jest.fn(),
    recordException: jest.fn(),
  };
}

describe('CorelensHttpInterceptor', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('normalises Nest root and handler route metadata', async () => {
    const { interceptor, lens } = createInterceptor();
    const context = createHttpContext({
      controller: RootController,
      handler: RootController.prototype.getMetrics,
      path: '/metrics',
    });

    await lastValueFrom(
      interceptor.intercept(context, { handle: () => of('ok') }) as any,
    );

    expect(lens.httpTracingRecorder.start).toHaveBeenCalledWith(
      expect.objectContaining({
        method: 'GET',
        route: '/metrics',
      }),
    );
    expect(lens.httpMetricsRecorder.record).toHaveBeenCalledWith(
      expect.objectContaining({
        method: 'GET',
        route: '/metrics',
        status: 200,
      }),
    );
  });

  it('normalises nested controller and parameter route metadata', async () => {
    const { interceptor, lens } = createInterceptor();
    const context = createHttpContext({
      controller: UsersController,
      handler: UsersController.prototype.getUser,
      path: '/users/42',
    });

    await lastValueFrom(
      interceptor.intercept(context, { handle: () => of('ok') }) as any,
    );

    expect(lens.httpTracingRecorder.start).toHaveBeenCalledWith(
      expect.objectContaining({
        method: 'GET',
        route: '/users/:id',
        target: '/users/42',
      }),
    );
  });

  it('records metrics even when tracing does not create a span', async () => {
    const { interceptor, lens } = createInterceptor({ span: undefined });
    const context = createHttpContext({
      controller: RootController,
      handler: RootController.prototype.getRoot,
      path: '/',
    });

    await lastValueFrom(
      interceptor.intercept(context, { handle: () => of('ok') }) as any,
    );

    expect(lens.tracer.enterWithSpan).not.toHaveBeenCalled();
    expect(lens.httpTracingRecorder.end).toHaveBeenCalledWith(undefined, {
      status: 200,
    });
    expect(lens.httpMetricsRecorder.record).toHaveBeenCalledWith(
      expect.objectContaining({
        method: 'GET',
        route: '/',
        status: 200,
      }),
    );
  });
});
