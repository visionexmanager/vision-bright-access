/** Errors whose message is safe to show a caller. Everything else is "unavailable". */
export class AppError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "AppError";
  }
}

export const unauthorized = () => new AppError(401, "UNAUTHORIZED", "Authentication required.");
export const forbidden = () => new AppError(403, "FORBIDDEN", "You are not allowed to do that.");
export const notFound = () => new AppError(404, "NOT_FOUND", "Not found.");
export const badRequest = (msg = "Invalid request.") => new AppError(400, "BAD_REQUEST", msg);
export const conflict = (code: string, msg: string) => new AppError(409, code, msg);
export const tooMany = () => new AppError(429, "RATE_LIMITED", "Too many requests. Try again later.");
export const unavailable = () => new AppError(503, "UNAVAILABLE", "Service temporarily unavailable.");

/** A provider cannot perform the operation (not verified against the real PI system). */
export class NotSupportedError extends Error {
  constructor(readonly operation: string) {
    super(`Operation not supported: ${operation}`);
    this.name = "NotSupportedError";
  }
}

/** The upstream ISP system failed. Detail stays in protected logs only. */
export class UpstreamError extends Error {
  constructor(
    message: string,
    readonly retriable = false,
  ) {
    super(message);
    this.name = "UpstreamError";
  }
}
