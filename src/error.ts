/**
 * @module error
 *
 * HTTP error classes and utilities for type-safe error handling.
 * Provides specific error classes for well-known HTTP status codes.
 */

import { HTTP_STATUS } from './status.ts';

/**
 * Base HTTP error class. Extends Error with HTTP-specific properties.
 * All specific error classes (NotFound, BadRequest, etc.) extend this class.
 *
 * @example
 * ```ts
 * try {
 *   await api.get("/resource");
 * } catch (error) {
 *   if (error instanceof HttpError) {
 *     console.log(error.status);     // e.g., 404
 *     console.log(error.statusText); // e.g., "Not Found"
 *     console.log(error.body);       // Response body
 *   }
 * }
 * ```
 */
class HttpError extends Error {
	public override name = 'HttpError';
	/** HTTP status code (e.g., 404, 500) */
	public status: number = HTTP_STATUS.ERROR_SERVER.INTERNAL_SERVER_ERROR.CODE;
	/** HTTP status text (e.g., "Not Found", "Internal Server Error") */
	public statusText: string = HTTP_STATUS.ERROR_SERVER.INTERNAL_SERVER_ERROR.TEXT;
	/** Response body (auto-parsed as JSON if possible) */
	public body: any = null;
}

// Client error classes (4xx)

/** HTTP 400 Bad Request error. */
class BadRequest extends HttpError {
	public override name = 'HttpBadRequestError';
	public override status = HTTP_STATUS.ERROR_CLIENT.BAD_REQUEST.CODE;
	public override statusText = HTTP_STATUS.ERROR_CLIENT.BAD_REQUEST.TEXT;
}

/** HTTP 401 Unauthorized error. */
class Unauthorized extends HttpError {
	public override name = 'HttpUnauthorizedError';
	public override status = HTTP_STATUS.ERROR_CLIENT.UNAUTHORIZED.CODE;
	public override statusText = HTTP_STATUS.ERROR_CLIENT.UNAUTHORIZED.TEXT;
}

/** HTTP 403 Forbidden error. */
class Forbidden extends HttpError {
	public override name = 'HttpForbiddenError';
	public override status = HTTP_STATUS.ERROR_CLIENT.FORBIDDEN.CODE;
	public override statusText = HTTP_STATUS.ERROR_CLIENT.FORBIDDEN.TEXT;
}

/** HTTP 404 Not Found error. */
class NotFound extends HttpError {
	public override name = 'HttpNotFoundError';
	public override status = HTTP_STATUS.ERROR_CLIENT.NOT_FOUND.CODE;
	public override statusText = HTTP_STATUS.ERROR_CLIENT.NOT_FOUND.TEXT;
}

/** HTTP 405 Method Not Allowed error. */
class MethodNotAllowed extends HttpError {
	public override name = 'HttpMethodNotAllowedError';
	public override status = HTTP_STATUS.ERROR_CLIENT.METHOD_NOT_ALLOWED.CODE;
	public override statusText = HTTP_STATUS.ERROR_CLIENT.METHOD_NOT_ALLOWED.TEXT;
}

/** HTTP 408 Request Timeout error. */
class RequestTimeout extends HttpError {
	public override name = 'HttpRequestTimeoutError';
	public override status = HTTP_STATUS.ERROR_CLIENT.REQUEST_TIMEOUT.CODE;
	public override statusText = HTTP_STATUS.ERROR_CLIENT.REQUEST_TIMEOUT.TEXT;
}

/** HTTP 409 Conflict error. */
class Conflict extends HttpError {
	public override name = 'HttpConflictError';
	public override status = HTTP_STATUS.ERROR_CLIENT.CONFLICT.CODE;
	public override statusText = HTTP_STATUS.ERROR_CLIENT.CONFLICT.TEXT;
}

/** HTTP 410 Gone error. */
class Gone extends HttpError {
	public override name = 'HttpGoneError';
	public override status = HTTP_STATUS.ERROR_CLIENT.GONE.CODE;
	public override statusText = HTTP_STATUS.ERROR_CLIENT.GONE.TEXT;
}

/** HTTP 411 Length Required error. */
class LengthRequired extends HttpError {
	public override name = 'HttpLengthRequiredError';
	public override status = HTTP_STATUS.ERROR_CLIENT.LENGTH_REQUIRED.CODE;
	public override statusText = HTTP_STATUS.ERROR_CLIENT.LENGTH_REQUIRED.TEXT;
}

/** HTTP 422 Unprocessable Content error. */
class UnprocessableContent extends HttpError {
	public override name = 'HttpUnprocessableContentError';
	public override status = HTTP_STATUS.ERROR_CLIENT.UNPROCESSABLE_CONTENT.CODE;
	public override statusText = HTTP_STATUS.ERROR_CLIENT.UNPROCESSABLE_CONTENT.TEXT;
}

/** HTTP 429 Too Many Requests error. */
class TooManyRequests extends HttpError {
	public override name = 'HttpTooManyRequestsError';
	public override status = HTTP_STATUS.ERROR_CLIENT.TOO_MANY_REQUESTS.CODE;
	public override statusText = HTTP_STATUS.ERROR_CLIENT.TOO_MANY_REQUESTS.TEXT;
}

/** HTTP 418 I'm a Teapot error. */
class ImATeapot extends HttpError {
	public override name = 'HttpImATeapotError';
	public override status = HTTP_STATUS.ERROR_CLIENT.IM_A_TEAPOT.CODE;
	public override statusText = HTTP_STATUS.ERROR_CLIENT.IM_A_TEAPOT.TEXT;
}

// Server error classes (5xx)

/** HTTP 500 Internal Server Error. */
class InternalServerError extends HttpError {
	public override name = 'HttpInternalServerError';
}

/** HTTP 501 Not Implemented error. */
class NotImplemented extends HttpError {
	public override name = 'HttpNotImplementedError';
	public override status = HTTP_STATUS.ERROR_SERVER.NOT_IMPLEMENTED.CODE;
	public override statusText = HTTP_STATUS.ERROR_SERVER.NOT_IMPLEMENTED.TEXT;
}

/** HTTP 502 Bad Gateway error. */
class BadGateway extends HttpError {
	public override name = 'HttpBadGatewayError';
	public override status = HTTP_STATUS.ERROR_SERVER.BAD_GATEWAY.CODE;
	public override statusText = HTTP_STATUS.ERROR_SERVER.BAD_GATEWAY.TEXT;
}

/** HTTP 503 Service Unavailable error. */
class ServiceUnavailable extends HttpError {
	public override name = 'HttpServiceUnavailableError';
	public override status = HTTP_STATUS.ERROR_SERVER.SERVICE_UNAVAILABLE.CODE;
	public override statusText = HTTP_STATUS.ERROR_SERVER.SERVICE_UNAVAILABLE.TEXT;
}

// Export individual error classes for direct imports
export {
	HttpError,
	// Client errors
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
	// Server errors
	InternalServerError,
	NotImplemented,
	BadGateway,
	ServiceUnavailable,
};

/**
 * Namespace containing all HTTP error classes for convenient access.
 *
 * @example
 * ```ts
 * import { HTTP_ERROR } from "@marianmeres/http-utils";
 *
 * try {
 *   await api.get("/resource");
 * } catch (error) {
 *   if (error instanceof HTTP_ERROR.NotFound) {
 *     console.log("Resource not found");
 *   }
 *   if (error instanceof HTTP_ERROR.HttpError) {
 *     console.log("HTTP error:", error.status);
 *   }
 * }
 * ```
 */
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

const _maybeJsonParse = (v: any) => {
	if (typeof v === 'string') {
		try {
			v = JSON.parse(v);
		} catch (e) {}
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
export const createHttpError = (
	code: number | string,
	message?: string | null,
	body?: any,
	cause?: any
): HttpError => {
	const fallback = HTTP_STATUS.ERROR_SERVER.INTERNAL_SERVER_ERROR;

	code = Number(code);
	if (isNaN(code) || !(code >= 400 && code < 600)) code = fallback.CODE;

	// opinionated conventions
	body = _maybeJsonParse(body);
	cause = _maybeJsonParse(cause);

	// try to find the well known one, otherwise fallback to generic
	const ctor =
		_wellKnownCtorMap[`${code}` as keyof typeof _wellKnownCtorMap] ?? HttpError;

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
export const getErrorMessage = (e: any, stripErrorPrefix = true): string => {
	if (!e) return '';

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
