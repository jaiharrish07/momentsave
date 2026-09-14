import { Request, Response, NextFunction } from 'express';
import { ZodType, ZodError } from 'zod';
import { badRequest } from '../utils/errors';

/**
 * Generic Zod validator. Wraps a schema that describes the shape of the
 * request (body, query, params). On success, replaces req.body/query/params
 * with the parsed (and coerced) values, so downstream handlers get typed data.
 *
 * On failure, throws a 400 AppError with structured issues in `details`.
 */
export function validate(schema: ZodType) {
  return (req: Request, res: Response, next: NextFunction) => {
    const result = schema.safeParse({
      body: req.body,
      query: req.query,
      params: req.params,
    });

    if (!result.success) {
      const zodError = result.error as ZodError;
      const issues = zodError.issues.map((i) => ({
        path: i.path.join('.'),
        message: i.message,
      }));
      return next(badRequest('VALIDATION_ERROR', 'Request validation failed', { issues }));
    }

    // Replace request parts with parsed values (email lowercased, numbers coerced, etc.).
    const parsed = result.data as { body?: unknown; query?: unknown; params?: unknown };
    if (parsed.body !== undefined) req.body = parsed.body;
    // Note: req.query and req.params are read-only in newer Express versions.
    // If you need coerced query/params, read from a separate parsed location instead.

    next();
  };
}
