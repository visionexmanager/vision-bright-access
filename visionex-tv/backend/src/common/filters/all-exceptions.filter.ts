import {
  ExceptionFilter, Catch, ArgumentsHost,
  HttpException, HttpStatus, Logger,
} from "@nestjs/common";
import type { Request, Response } from "express";

/**
 * Global exception filter.
 * Rule: NEVER expose raw errors to clients.
 * Maps every thrown value to a clean JSON envelope.
 */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx     = host.switchToHttp();
    const req     = ctx.getRequest<Request>();
    const res     = ctx.getResponse<Response>();

    let status  = HttpStatus.INTERNAL_SERVER_ERROR;
    let message = "An unexpected error occurred";
    let code    = "INTERNAL_ERROR";

    if (exception instanceof HttpException) {
      status  = exception.getStatus();
      const body = exception.getResponse();
      if (typeof body === "string") {
        message = body;
      } else if (typeof body === "object" && body !== null) {
        const b = body as Record<string, unknown>;
        message = (b.message as string | string[]) instanceof Array
          ? (b.message as string[]).join("; ")
          : String(b.message ?? message);
        code    = String(b.error ?? code);
      }
    } else if (exception instanceof Error) {
      // Log internal errors with full stack — never leak to client
      this.logger.error(
        `${req.method} ${req.url} — ${exception.message}`,
        exception.stack
      );
    } else {
      this.logger.error(`Non-Error thrown: ${String(exception)}`);
    }

    res.status(status).json({
      success:   false,
      error:     { code, message },
      path:      req.url,
      timestamp: new Date().toISOString(),
    });
  }
}
