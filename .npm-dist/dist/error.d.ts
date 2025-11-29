/**
 * Base HTTP error class. Extends Error with HTTP-specific properties.
 */
declare class HttpError extends Error {
    name: string;
    /** HTTP status code (e.g., 404, 500) */
    status: number;
    /** HTTP status text (e.g., "Not Found", "Internal Server Error") */
    statusText: string;
    /** Response body (auto-parsed as JSON if possible) */
    body: any;
}
declare class BadRequest extends HttpError {
    name: string;
    status: number;
    statusText: string;
}
declare class Unauthorized extends HttpError {
    name: string;
    status: number;
    statusText: string;
}
declare class Forbidden extends HttpError {
    name: string;
    status: number;
    statusText: string;
}
declare class NotFound extends HttpError {
    name: string;
    status: number;
    statusText: string;
}
declare class MethodNotAllowed extends HttpError {
    name: string;
    status: number;
    statusText: string;
}
declare class RequestTimeout extends HttpError {
    name: string;
    status: number;
    statusText: string;
}
declare class Conflict extends HttpError {
    name: string;
    status: number;
    statusText: string;
}
declare class Gone extends HttpError {
    name: string;
    status: number;
    statusText: string;
}
declare class LengthRequired extends HttpError {
    name: string;
    status: number;
    statusText: string;
}
declare class UnprocessableContent extends HttpError {
    name: string;
    status: number;
    statusText: string;
}
declare class TooManyRequests extends HttpError {
    name: string;
    status: number;
    statusText: string;
}
declare class ImATeapot extends HttpError {
    name: string;
    status: number;
    statusText: string;
}
declare class InternalServerError extends HttpError {
    name: string;
}
declare class NotImplemented extends HttpError {
    name: string;
    status: number;
    statusText: string;
}
declare class BadGateway extends HttpError {
    name: string;
    status: number;
    statusText: string;
}
declare class ServiceUnavailable extends HttpError {
    name: string;
    status: number;
    statusText: string;
}
export { HttpError, BadRequest, Unauthorized, Forbidden, NotFound, MethodNotAllowed, RequestTimeout, Conflict, Gone, LengthRequired, ImATeapot, UnprocessableContent, TooManyRequests, InternalServerError, NotImplemented, BadGateway, ServiceUnavailable, };
export declare const HTTP_ERROR: {
    HttpError: typeof HttpError;
    BadRequest: typeof BadRequest;
    Unauthorized: typeof Unauthorized;
    Forbidden: typeof Forbidden;
    NotFound: typeof NotFound;
    MethodNotAllowed: typeof MethodNotAllowed;
    RequestTimeout: typeof RequestTimeout;
    Conflict: typeof Conflict;
    Gone: typeof Gone;
    LengthRequired: typeof LengthRequired;
    ImATeapot: typeof ImATeapot;
    UnprocessableContent: typeof UnprocessableContent;
    TooManyRequests: typeof TooManyRequests;
    InternalServerError: typeof InternalServerError;
    NotImplemented: typeof NotImplemented;
    BadGateway: typeof BadGateway;
    ServiceUnavailable: typeof ServiceUnavailable;
};
/**
 * Creates an HTTP error from a status code and optional details.
 * Returns a specific error class for well-known status codes (e.g., 404 → NotFound),
 * or generic HttpError for unknown codes. Invalid codes default to 500.
 *
 * @param code - HTTP status code (400-599).
 * @param message - Optional error message (defaults to status text).
 * @param body - Optional response body (will be auto-parsed as JSON if it's a string).
 * @param cause - Optional error cause/details (will be auto-parsed as JSON if it's a string).
 *
 * @returns An HttpError instance (or subclass for well-known codes).
 *
 * @example
 * ```ts
 * const err = createHttpError(404, 'User not found', { id: 123 });
 * console.log(err instanceof NotFound); // true
 * console.log(err.status); // 404
 * console.log(err.body); // { id: 123 }
 * ```
 */
export declare const createHttpError: (code: number | string, message?: string | null, body?: any, cause?: any) => HttpError;
/**
 * Extracts a human-readable error message from various error formats.
 * Tries multiple strategies to find the best message, with fallbacks.
 *
 * Priority order:
 * 1. e.cause.message / e.cause.code / e.cause (if string)
 * 2. e.body.error.message / e.body.message / e.body.error / e.body (if string)
 * 3. e.message
 * 4. e.name
 * 5. e.toString()
 * 6. "Unknown Error"
 *
 * @param e - The error to extract a message from (can be any type).
 * @param stripErrorPrefix - Whether to remove "Error: " prefix from the message (default: true).
 *
 * @returns A human-readable error message string.
 */
export declare const getErrorMessage: (e: any, stripErrorPrefix?: boolean) => string;
