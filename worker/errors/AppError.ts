/**
 * Surakshit Vault Application Error Hierarchy
 * Standardized error codes and error response formatting.
 */

export type ErrorCode =
  | 'VALIDATION_ERROR'
  | 'UNAUTHORIZED'
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'CONFLICT'
  | 'RATE_LIMITED'
  | 'PAYLOAD_TOO_LARGE'
  | 'UNSUPPORTED_MEDIA_TYPE'
  | 'INTERNAL_ERROR';

export class AppError extends Error {
  public readonly code: ErrorCode;
  public readonly status: number;
  public readonly details?: Record<string, unknown>;

  constructor(
    code: ErrorCode,
    message: string,
    status: number,
    details?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'AppError';
    this.code = code;
    this.status = status;
    this.details = details;
    Object.setPrototypeOf(this, new.target.prototype);
  }

  static validation(message: string, details?: Record<string, unknown>): AppError {
    return new AppError('VALIDATION_ERROR', message, 400, details);
  }

  static unauthorized(message: string = 'Authentication required'): AppError {
    return new AppError('UNAUTHORIZED', message, 401);
  }

  static forbidden(message: string = 'Access denied'): AppError {
    return new AppError('FORBIDDEN', message, 403);
  }

  static notFound(message: string = 'Resource not found'): AppError {
    return new AppError('NOT_FOUND', message, 404);
  }

  static conflict(message: string, details?: Record<string, unknown>): AppError {
    return new AppError('CONFLICT', message, 409, details);
  }

  static rateLimited(message: string = 'Too many requests. Please try again later.'): AppError {
    return new AppError('RATE_LIMITED', message, 429);
  }

  static payloadTooLarge(message: string = 'Request payload is too large'): AppError {
    return new AppError('PAYLOAD_TOO_LARGE', message, 413);
  }

  static unsupportedMediaType(message: string = 'Content-Type must be application/json'): AppError {
    return new AppError('UNSUPPORTED_MEDIA_TYPE', message, 415);
  }

  static internal(message: string = 'An unexpected server error occurred.'): AppError {
    return new AppError('INTERNAL_ERROR', message, 500);
  }

  toResponseObject() {
    return {
      error: {
        code: this.code,
        message: this.message,
        ...(this.details ? { details: this.details } : {}),
      },
    };
  }
}
