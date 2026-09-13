/**
 * AppError — the only error type controllers should throw for expected failures.
 * The error handler middleware maps this to a well-formed JSON response.
 *
 * Any error NOT of this type is treated as a 500 Internal Server Error.
 */
export class AppError extends Error {
  public readonly statusCode: number;
  public readonly code: string;
  public readonly details?: Record<string, unknown>;

  constructor(
    statusCode: number,
    code: string,
    message: string,
    details?: Record<string, unknown>
  ) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
    this.name = 'AppError';
  }
}

// Convenience constructors matching common HTTP responses.
export const badRequest = (code: string, message: string, details?: Record<string, unknown>) =>
  new AppError(400, code, message, details);

export const unauthorized = (message = 'Not authenticated') =>
  new AppError(401, 'UNAUTHORIZED', message);

export const forbidden = (message = 'Not authorized') =>
  new AppError(403, 'FORBIDDEN', message);

export const notFound = (message = 'Not found') =>
  new AppError(404, 'NOT_FOUND', message);

export const conflict = (code: string, message: string) =>
  new AppError(409, code, message);

export const tooManyRequests = (message = 'Too many requests') =>
  new AppError(429, 'TOO_MANY_REQUESTS', message);
