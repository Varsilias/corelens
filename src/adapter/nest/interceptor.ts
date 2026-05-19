import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { PATH_METADATA } from '@nestjs/common/constants';
import { CorelensService } from './providers';
import { catchError, finalize, Observable, tap } from 'rxjs';
import { ISpan } from '../../core/traces/span';

@Injectable()
export class CorelensHttpInterceptor implements NestInterceptor {
  constructor(private readonly lens: CorelensService) {
    const isHttpTraceEnabled = this.lens.httpTracingRecorder.isEnabled;
    const isHttpMetricEnabled = this.lens.httpMetricsRecorder.isEnabled;

    if (!isHttpMetricEnabled || !isHttpTraceEnabled) {
      console.warn(
        '[Corelens] Corelens HTTP Interceptor is registered but one of HTTP tracing or metrics is disabled. check the value of "metrics.http" or "tracing.http"',
      );
    }
  }

  intercept(
    context: ExecutionContext,
    next: CallHandler<any>,
  ): Observable<any> | Promise<Observable<any>> {
    if (context.getType() !== 'http') {
      return next.handle();
    }

    const http = context.switchToHttp();
    const req = http.getRequest();
    const res = http.getResponse();

    const method = req.method;
    const route = this.getRoute(context, req);
    const target = req?.originalUrl ?? req?.url;

    const span = this.lens.httpTracingRecorder.start({
      method,
      route: route,
      target,
      protocol: req.protocol,
      traceparent: req.headers['traceparent'],
      userAgent: req.headers['user-agent'],
    });

    if (span) {
      this.lens.tracer.enterWithSpan(span);
    }

    const start = performance.now();

    return next.handle().pipe(
      tap(() => {
        if (span) {
          const status = res.statusCode ?? 200;
          span.setAttribute('http.status_code', status);
        }
      }),
      catchError((error) => {
        if (span) {
          span.setStatus('error');
          span.recordException(error);
        }
        throw error;
      }),
      finalize(() => {
        const status = res.statusCode ?? 500;
        const durationSeconds = (performance.now() - start) / 1000;
        this.recordTrace(span, { status });
        this.recordMetric({ durationSeconds, method, route, status });
      }),
    );
  }

  private getRoute(context: ExecutionContext, request: any): string {
    const controllerPath = this.getMetadataPath(context.getClass());
    const handlerPath = this.getMetadataPath(context.getHandler());

    if (controllerPath !== undefined || handlerPath !== undefined) {
      return this.joinRoutePaths(controllerPath, handlerPath);
    }

    const expressRoute = request?.route?.path;
    if (typeof expressRoute === 'string' && expressRoute.length > 0) {
      return this.joinRoutePaths(request?.baseUrl, expressRoute);
    }

    return request?.path ?? request?.url ?? 'unmatched_route';
  }

  // eslint-disable-next-line @typescript-eslint/no-unsafe-function-type
  private getMetadataPath(target: Function): string | undefined {
    const path = Reflect.getMetadata(PATH_METADATA, target);

    if (Array.isArray(path)) {
      return path[0];
    }

    if (typeof path === 'string') {
      return path;
    }

    return undefined;
  }

  private joinRoutePaths(
    controllerPath?: string,
    handlerPath?: string,
  ): string {
    const parts = [controllerPath, handlerPath]
      .filter((part): part is string => typeof part === 'string')
      .map((part) => part.trim())
      .map((part) => part.replace(/^\/+|\/+$/g, ''))
      .filter((part) => part.length > 0);

    if (parts.length === 0) {
      return '/';
    }

    return `/${parts.join('/')}`;
  }

  private recordTrace(span: ISpan | undefined, data: { status: number }) {
    this.lens.httpTracingRecorder.end(span, data);
  }
  private recordMetric(data: {
    method: string;
    route: string;
    status: number;
    durationSeconds: number;
  }) {
    this.lens.httpMetricsRecorder.record({
      method: data.method,
      route: data.route,
      status: data.status,
      durationSeconds: data.durationSeconds,
    });
  }
}
