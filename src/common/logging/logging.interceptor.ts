import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap, catchError } from 'rxjs/operators';
import { FileLoggerService } from './file-logger.service';

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  constructor(private readonly fileLogger: FileLoggerService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const req = context.switchToHttp().getRequest();
    const start = Date.now();

    this.fileLogger.log('request', {
      method: req?.method,
      url: req?.url,
      ip: req?.ip,
      body: req?.body,
      query: req?.query,
      params: req?.params,
    });

    return next.handle().pipe(
      tap((data) => {
        const durationMs = Date.now() - start;
        this.fileLogger.log('response', {
          method: req?.method,
          url: req?.url,
          statusCode: context.switchToHttp().getResponse()?.statusCode,
          durationMs,
        });
      }),
      catchError((err) => {
        const durationMs = Date.now() - start;
        this.fileLogger.error('error', {
          method: req?.method,
          url: req?.url,
          statusCode: err?.status || 500,
          message: err?.message,
          stack: err?.stack,
          durationMs,
        });
        throw err;
      }),
    );
  }
}


