import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { ThrottlerException } from '@nestjs/throttler';

@Catch()
export class UnifiedExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(UnifiedExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message = 'Internal server error';

    if (exception instanceof ThrottlerException) {
      status = HttpStatus.TOO_MANY_REQUESTS;
      message = 'Too many requests. Please try again later.';
    } else if (exception instanceof HttpException) {
      status = exception.getStatus();
      const exceptionResponse = exception.getResponse() as any;

      if (typeof exceptionResponse === 'string') {
        message = this.cleanExceptionPrefix(exceptionResponse);
      } else if (exceptionResponse) {
        if (
          exceptionResponse.errors &&
          Array.isArray(exceptionResponse.errors)
        ) {
          const firstError = exceptionResponse.errors[0];
          message = `${firstError.field}: ${firstError.message}`;
        } else if (exceptionResponse.message) {
          message = this.cleanExceptionPrefix(
            Array.isArray(exceptionResponse.message)
              ? exceptionResponse.message[0]
              : exceptionResponse.message,
          );
        } else if (exceptionResponse.error) {
          message = this.cleanExceptionPrefix(exceptionResponse.error);
        }
      }
    } else if (exception instanceof Error) {
      message = this.cleanExceptionPrefix(exception.message);
      this.logger.error(`Unhandled error: ${message}`, exception.stack);
    }

    const errorResponse = {
      statusCode: status,
      message: message,
      timestamp: new Date().toISOString(),
      path: request.url,
    };
    if (status >= HttpStatus.INTERNAL_SERVER_ERROR) {
      this.logger.error(
        `${status} ${request.method} ${request.url}`,
        errorResponse,
      );
    }

    response.status(status).json(errorResponse);
  }

  private cleanExceptionPrefix(text: string): string {
    return text
      .replace(/^ThrottlerException:\s*/i, '')
      .replace(/^BadRequestException:\s*/i, '')
      .replace(/^ConflictException:\s*/i, '')
      .replace(/^UnauthorizedException:\s*/i, '')
      .replace(/^NotFoundException:\s*/i, '')
      .trim();
  }
}
