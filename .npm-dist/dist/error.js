import { HTTP_STATUS } from './status.js';
/**
 * Base HTTP error class. Extends Error with HTTP-specific properties.
 */
class HttpError extends Error {
    name = 'HttpError';
    /** HTTP status code (e.g., 404, 500) */
    status = HTTP_STATUS.ERROR_SERVER.INTERNAL_SERVER_ERROR.CODE;
    /** HTTP status text (e.g., "Not Found", "Internal Server Error") */
    statusText = HTTP_STATUS.ERROR_SERVER.INTERNAL_SERVER_ERROR.TEXT;
    /** Response body (auto-parsed as JSON if possible) */
    body = null;
}
// some more specific instances of the well known ones...
// client
class BadRequest extends HttpError {
    name = 'HttpBadRequestError';
    status = HTTP_STATUS.ERROR_CLIENT.BAD_REQUEST.CODE;
    statusText = HTTP_STATUS.ERROR_CLIENT.BAD_REQUEST.TEXT;
}
class Unauthorized extends HttpError {
    name = 'HttpUnauthorizedError';
    status = HTTP_STATUS.ERROR_CLIENT.UNAUTHORIZED.CODE;
    statusText = HTTP_STATUS.ERROR_CLIENT.UNAUTHORIZED.TEXT;
}
class Forbidden extends HttpError {
    name = 'HttpForbiddenError';
    status = HTTP_STATUS.ERROR_CLIENT.FORBIDDEN.CODE;
    statusText = HTTP_STATUS.ERROR_CLIENT.FORBIDDEN.TEXT;
}
class NotFound extends HttpError {
    name = 'HttpNotFoundError';
    status = HTTP_STATUS.ERROR_CLIENT.NOT_FOUND.CODE;
    statusText = HTTP_STATUS.ERROR_CLIENT.NOT_FOUND.TEXT;
}
class MethodNotAllowed extends HttpError {
    name = 'HttpMethodNotAllowedError';
    status = HTTP_STATUS.ERROR_CLIENT.METHOD_NOT_ALLOWED.CODE;
    statusText = HTTP_STATUS.ERROR_CLIENT.METHOD_NOT_ALLOWED.TEXT;
}
class RequestTimeout extends HttpError {
    name = 'HttpRequestTimeoutError';
    status = HTTP_STATUS.ERROR_CLIENT.REQUEST_TIMEOUT.CODE;
    statusText = HTTP_STATUS.ERROR_CLIENT.REQUEST_TIMEOUT.TEXT;
}
class Conflict extends HttpError {
    name = 'HttpConflictError';
    status = HTTP_STATUS.ERROR_CLIENT.CONFLICT.CODE;
    statusText = HTTP_STATUS.ERROR_CLIENT.CONFLICT.TEXT;
}
class Gone extends HttpError {
    name = 'HttpGoneError';
    status = HTTP_STATUS.ERROR_CLIENT.GONE.CODE;
    statusText = HTTP_STATUS.ERROR_CLIENT.GONE.TEXT;
}
class LengthRequired extends HttpError {
    name = 'HttpLengthRequiredError';
    status = HTTP_STATUS.ERROR_CLIENT.LENGTH_REQUIRED.CODE;
    statusText = HTTP_STATUS.ERROR_CLIENT.LENGTH_REQUIRED.TEXT;
}
class UnprocessableContent extends HttpError {
    name = 'HttpUnprocessableContentError';
    status = HTTP_STATUS.ERROR_CLIENT.UNPROCESSABLE_CONTENT.CODE;
    statusText = HTTP_STATUS.ERROR_CLIENT.UNPROCESSABLE_CONTENT.TEXT;
}
class TooManyRequests extends HttpError {
    name = 'HttpTooManyRequestsError';
    status = HTTP_STATUS.ERROR_CLIENT.TOO_MANY_REQUESTS.CODE;
    statusText = HTTP_STATUS.ERROR_CLIENT.TOO_MANY_REQUESTS.TEXT;
}
class ImATeapot extends HttpError {
    name = 'HttpImATeapotError';
    status = HTTP_STATUS.ERROR_CLIENT.IM_A_TEAPOT.CODE;
    statusText = HTTP_STATUS.ERROR_CLIENT.IM_A_TEAPOT.TEXT;
}
// server
class InternalServerError extends HttpError {
    name = 'HttpInternalServerError';
}
class NotImplemented extends HttpError {
    name = 'HttpServiceUnavailableError';
    status = HTTP_STATUS.ERROR_SERVER.NOT_IMPLEMENTED.CODE;
    statusText = HTTP_STATUS.ERROR_SERVER.NOT_IMPLEMENTED.TEXT;
}
class BadGateway extends HttpError {
    name = 'HttpBadGatewayError';
    status = HTTP_STATUS.ERROR_SERVER.BAD_GATEWAY.CODE;
    statusText = HTTP_STATUS.ERROR_SERVER.BAD_GATEWAY.TEXT;
}
class ServiceUnavailable extends HttpError {
    name = 'HttpServiceUnavailableError';
    status = HTTP_STATUS.ERROR_SERVER.SERVICE_UNAVAILABLE.CODE;
    statusText = HTTP_STATUS.ERROR_SERVER.SERVICE_UNAVAILABLE.TEXT;
}
// Export individual error classes
export { HttpError, 
// Client errors
BadRequest, Unauthorized, Forbidden, NotFound, MethodNotAllowed, RequestTimeout, Conflict, Gone, LengthRequired, ImATeapot, UnprocessableContent, TooManyRequests, 
// Server errors
InternalServerError, NotImplemented, BadGateway, ServiceUnavailable, };
// Namespace export for convenience
export const HTTP_ERROR = {
    // base
    HttpError,
    // client
    BadRequest,
    Unauthorized,
    Forbidden,
    NotFound,
    MethodNotAllowed,
    RequestTimeout,
    Conflict,
    Gone,
    LengthRequired,
    ImATeapot,
    UnprocessableContent,
    TooManyRequests,
    // server
    InternalServerError,
    NotImplemented,
    BadGateway,
    ServiceUnavailable,
};
const _wellKnownCtorMap = {
    '400': BadRequest,
    '401': Unauthorized,
    '403': Forbidden,
    '404': NotFound,
    '405': MethodNotAllowed,
    '408': RequestTimeout,
    '409': Conflict,
    '410': Gone,
    '411': LengthRequired,
    '418': ImATeapot,
    '422': UnprocessableContent,
    '429': TooManyRequests,
    //
    '500': InternalServerError,
    '501': NotImplemented,
    '502': BadGateway,
    '503': ServiceUnavailable,
};
const _maybeJsonParse = (v) => {
    if (typeof v === 'string') {
        try {
            v = JSON.parse(v);
        }
        catch (e) { }
    }
    return v;
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
export const createHttpError = (code, message, body, cause) => {
    const fallback = HTTP_STATUS.ERROR_SERVER.INTERNAL_SERVER_ERROR;
    code = Number(code);
    if (isNaN(code) || !(code >= 400 && code < 600))
        code = fallback.CODE;
    // opinionated conventions
    body = _maybeJsonParse(body);
    cause = _maybeJsonParse(cause);
    // try to find the well known one, otherwise fallback to generic
    const ctor = _wellKnownCtorMap[`${code}`] ?? HttpError;
    //
    const found = HTTP_STATUS.findByCode(code);
    const statusText = found?.TEXT ?? fallback.TEXT;
    //
    let e = new ctor(message || statusText, { cause });
    e.status = found?.CODE ?? fallback.CODE;
    e.statusText = statusText;
    e.body = body;
    return e;
};
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
export const getErrorMessage = (e, stripErrorPrefix = true) => {
    if (!e)
        return '';
    // Errors may bubble from various sources which are not always under control.
    // We try our best to extract a meaningful message using common conventions.
    const cause = _maybeJsonParse(e?.cause);
    const body = _maybeJsonParse(e?.body);
    let msg = 
    // https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Error/cause
    // e.cause is the standard prop for error details, so should be considered as
    // the most authoritative (if available)
    // "code" and "message" are my own conventions
    cause?.message ||
        cause?.code ||
        (typeof cause === 'string' ? cause : null) ||
        // non-standard "body" is this package's HttpError prop
        body?.error?.message ||
        body?.message ||
        body?.error ||
        (typeof body === 'string' ? body : null) ||
        // the common message from Error ctor (e.g. "Foo" if new TypeError("Foo"))
        e?.message ||
        // the Error class name (e.g. TypeError)
        e?.name ||
        // this should handle (almost) everything else (mainly if e is not an Error instance)
        e?.toString() ||
        // very last fallback if `toString()` was not available (or returned empty)
        'Unknown Error';
    // ensure we're sending string
    msg = `${msg}`;
    if (stripErrorPrefix) {
        msg = msg.replace(/^[^:]*Error: /i, '');
    }
    return msg;
};
