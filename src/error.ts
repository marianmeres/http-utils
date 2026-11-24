/**
 * @module error
 *
 * HTTP error classes and utilities for type-safe error handling.
 * Provides specific error classes for well-known HTTP status codes.
 */

import {
	ABOUT_BLANK,
	getBodyMessage,
	maybeJsonParse,
	type ProblemDetails,
	problemOf,
	recordOf,
	textOf,
} from "./problem.ts";
import { HTTP_STATUS } from "./status.ts";

/**
 * The key a class of this package is registered under (`"NotFound"`, ...), set on the
 * class itself. `Symbol.for`, so that every installed copy of the package reads and
 * writes the same key: it is what lets `instanceof` recognize an error another copy
 * threw (see `hasInstance` below).
 */
const KIND: unique symbol = Symbol.for("@marianmeres/http-utils/error-kind");

/**
 * The media type of the response an error's `body` came with, for the errors the
 * `HttpApi` client throws. Kept beside the error instead of on it: it is one input of
 * `HttpError.problem`, not a member worth reading on its own.
 */
const _mediaTypes = new WeakMap<object, string>();

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
	public override name = "HttpError";
	/** HTTP status code (e.g., 404, 500) */
	public status: number = HTTP_STATUS.ERROR_SERVER.INTERNAL_SERVER_ERROR.CODE;
	/** HTTP status text (e.g., "Not Found", "Internal Server Error") */
	public statusText: string = HTTP_STATUS.ERROR_SERVER.INTERNAL_SERVER_ERROR.TEXT;
	/** Response body (auto-parsed as JSON if possible) */
	public body: unknown = null;
	/**
	 * The request method. Set on the errors an `HttpApi` method throws; absent on an
	 * error you construct yourself.
	 */
	declare public method?: string;
	/**
	 * The fully resolved request URL (base, path, query string and, where the runtime
	 * reports it, the post-redirect location). Set on the errors an `HttpApi` method
	 * throws; absent on an error you construct yourself.
	 */
	declare public url?: string;

	/**
	 * The error as an RFC 9457 Problem Details document, read from `body` (see
	 * `problemOf`). Always there: a body that is not a problem document is the
	 * `"about:blank"` problem, whose `title` is the status phrase and whose `detail`
	 * is the body's own sentence when it has one.
	 */
	get problem(): ProblemDetails {
		return problemOf(this.body, {
			status: this.status,
			statusText: this.statusText,
			mediaType: _mediaTypes.get(this),
		});
	}

	/**
	 * The problem's stable identity (`problem.type`): the member to branch on when the
	 * server answers with typed problem documents, since one status covers unrelated
	 * refusals. `"about:blank"` when the response named none.
	 */
	get type(): string {
		return this.problem.type;
	}
}

// Client error classes (4xx)

/** HTTP 400 Bad Request error. */
class BadRequest extends HttpError {
	public override name = "HttpBadRequestError";
	public override status = HTTP_STATUS.ERROR_CLIENT.BAD_REQUEST.CODE;
	public override statusText = HTTP_STATUS.ERROR_CLIENT.BAD_REQUEST.TEXT;
}

/** HTTP 401 Unauthorized error. */
class Unauthorized extends HttpError {
	public override name = "HttpUnauthorizedError";
	public override status = HTTP_STATUS.ERROR_CLIENT.UNAUTHORIZED.CODE;
	public override statusText = HTTP_STATUS.ERROR_CLIENT.UNAUTHORIZED.TEXT;
}

/** HTTP 403 Forbidden error. */
class Forbidden extends HttpError {
	public override name = "HttpForbiddenError";
	public override status = HTTP_STATUS.ERROR_CLIENT.FORBIDDEN.CODE;
	public override statusText = HTTP_STATUS.ERROR_CLIENT.FORBIDDEN.TEXT;
}

/** HTTP 404 Not Found error. */
class NotFound extends HttpError {
	public override name = "HttpNotFoundError";
	public override status = HTTP_STATUS.ERROR_CLIENT.NOT_FOUND.CODE;
	public override statusText = HTTP_STATUS.ERROR_CLIENT.NOT_FOUND.TEXT;
}

/** HTTP 405 Method Not Allowed error. */
class MethodNotAllowed extends HttpError {
	public override name = "HttpMethodNotAllowedError";
	public override status = HTTP_STATUS.ERROR_CLIENT.METHOD_NOT_ALLOWED.CODE;
	public override statusText = HTTP_STATUS.ERROR_CLIENT.METHOD_NOT_ALLOWED.TEXT;
}

/** HTTP 408 Request Timeout error. */
class RequestTimeout extends HttpError {
	public override name = "HttpRequestTimeoutError";
	public override status = HTTP_STATUS.ERROR_CLIENT.REQUEST_TIMEOUT.CODE;
	public override statusText = HTTP_STATUS.ERROR_CLIENT.REQUEST_TIMEOUT.TEXT;
}

/** HTTP 409 Conflict error. */
class Conflict extends HttpError {
	public override name = "HttpConflictError";
	public override status = HTTP_STATUS.ERROR_CLIENT.CONFLICT.CODE;
	public override statusText = HTTP_STATUS.ERROR_CLIENT.CONFLICT.TEXT;
}

/** HTTP 410 Gone error. */
class Gone extends HttpError {
	public override name = "HttpGoneError";
	public override status = HTTP_STATUS.ERROR_CLIENT.GONE.CODE;
	public override statusText = HTTP_STATUS.ERROR_CLIENT.GONE.TEXT;
}

/** HTTP 411 Length Required error. */
class LengthRequired extends HttpError {
	public override name = "HttpLengthRequiredError";
	public override status = HTTP_STATUS.ERROR_CLIENT.LENGTH_REQUIRED.CODE;
	public override statusText = HTTP_STATUS.ERROR_CLIENT.LENGTH_REQUIRED.TEXT;
}

/** HTTP 422 Unprocessable Content error. */
class UnprocessableContent extends HttpError {
	public override name = "HttpUnprocessableContentError";
	public override status = HTTP_STATUS.ERROR_CLIENT.UNPROCESSABLE_CONTENT.CODE;
	public override statusText = HTTP_STATUS.ERROR_CLIENT.UNPROCESSABLE_CONTENT.TEXT;
}

/** HTTP 429 Too Many Requests error. */
class TooManyRequests extends HttpError {
	public override name = "HttpTooManyRequestsError";
	public override status = HTTP_STATUS.ERROR_CLIENT.TOO_MANY_REQUESTS.CODE;
	public override statusText = HTTP_STATUS.ERROR_CLIENT.TOO_MANY_REQUESTS.TEXT;
}

/** HTTP 418 I'm a Teapot error. */
class ImATeapot extends HttpError {
	public override name = "HttpImATeapotError";
	public override status = HTTP_STATUS.ERROR_CLIENT.IM_A_TEAPOT.CODE;
	public override statusText = HTTP_STATUS.ERROR_CLIENT.IM_A_TEAPOT.TEXT;
}

// Server error classes (5xx)

/** HTTP 500 Internal Server Error. */
class InternalServerError extends HttpError {
	public override name = "HttpInternalServerError";
}

/** HTTP 501 Not Implemented error. */
class NotImplemented extends HttpError {
	public override name = "HttpNotImplementedError";
	public override status = HTTP_STATUS.ERROR_SERVER.NOT_IMPLEMENTED.CODE;
	public override statusText = HTTP_STATUS.ERROR_SERVER.NOT_IMPLEMENTED.TEXT;
}

/** HTTP 502 Bad Gateway error. */
class BadGateway extends HttpError {
	public override name = "HttpBadGatewayError";
	public override status = HTTP_STATUS.ERROR_SERVER.BAD_GATEWAY.CODE;
	public override statusText = HTTP_STATUS.ERROR_SERVER.BAD_GATEWAY.TEXT;
}

/** HTTP 503 Service Unavailable error. */
class ServiceUnavailable extends HttpError {
	public override name = "HttpServiceUnavailableError";
	public override status = HTTP_STATUS.ERROR_SERVER.SERVICE_UNAVAILABLE.CODE;
	public override statusText = HTTP_STATUS.ERROR_SERVER.SERVICE_UNAVAILABLE.TEXT;
}

// Transport-level error (no HTTP response was received)

/**
 * Transport-level failure: DNS resolution failure, refused connection, connect
 * timeout, unreachable host, etc. No HTTP response was received, so `status` is
 * `0` (the de-facto web convention for network-level failures, mirroring
 * `XMLHttpRequest.status`). Thrown by `fetchOrThrow` (and, by extension, by the
 * `HttpApi` client) with the underlying transport error attached as `cause`, so
 * the real reason (`ENOTFOUND`, `ECONNREFUSED`, ...) is never swallowed behind
 * an opaque "fetch failed".
 *
 * @example
 * ```ts
 * try {
 *   await api.get("/resource");
 * } catch (error) {
 *   if (error instanceof HTTP_ERROR.NetworkError) {
 *     console.log(error.message); // e.g. "GET unreachable (https://...): ECONNREFUSED"
 *     console.log(error.cause);   // the underlying transport error
 *   }
 * }
 * ```
 */
class NetworkError extends HttpError {
	public override name = "HttpNetworkError";
	public override status = 0;
	public override statusText = "Network Error";
}

// Export individual error classes for direct imports
export {
	BadGateway,
	// Client errors
	BadRequest,
	Conflict,
	Forbidden,
	Gone,
	HttpError,
	ImATeapot,
	// Server errors
	InternalServerError,
	LengthRequired,
	MethodNotAllowed,
	// Transport error
	NetworkError,
	NotFound,
	NotImplemented,
	RequestTimeout,
	ServiceUnavailable,
	TooManyRequests,
	Unauthorized,
	UnprocessableContent,
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
	// transport
	NetworkError,
};

/**
 * `instanceof`, holding across installed copies of this package.
 *
 * Two packages that each resolved their own copy do not share class objects, so an
 * error thrown by one would fail the other's `instanceof NotFound` and fall through
 * to its generic handling. Every class of this package is registered under a key
 * that all copies share ({@link KIND}), and an error whose prototype chain holds a
 * class registered under the same key as the class asked about is an instance of it.
 *
 * A subclass of your own keeps plain `instanceof` semantics: it is registered under
 * no key, so only the ordinary prototype walk answers for it.
 *
 * `this` is the class on the right-hand side of `instanceof`.
 */
function hasInstance(this: unknown, value: unknown): boolean {
	// This copy's own instances, subclasses included.
	if (Function.prototype[Symbol.hasInstance].call(this, value)) return true;
	if (value === null || typeof value !== "object") return false;
	if (typeof this !== "function" || !Object.hasOwn(this, KIND)) return false;
	const kind = (this as unknown as Record<symbol, unknown>)[KIND];
	for (
		let proto: unknown = Object.getPrototypeOf(value);
		proto !== null && typeof proto === "object";
		proto = Object.getPrototypeOf(proto)
	) {
		const ctor: unknown = Object.hasOwn(proto, "constructor")
			? (proto as { constructor: unknown }).constructor
			: undefined;
		if (
			typeof ctor === "function" &&
			Object.hasOwn(ctor, KIND) &&
			(ctor as unknown as Record<symbol, unknown>)[KIND] === kind
		) {
			return true;
		}
	}
	return false;
}

// On the base class, so every class below inherits it (statics are inherited).
Object.defineProperty(HttpError, Symbol.hasInstance, { value: hasInstance });

// Register every class under its `HTTP_ERROR` key. Own properties: a subclass of
// yours must not inherit its parent's registration.
for (const [kind, ctor] of Object.entries(HTTP_ERROR)) {
	Object.defineProperty(ctor, KIND, { value: kind });
}

/**
 * The shape this package's generic error code reads: `getErrorMessage`, and anything
 * written against the data members of `HttpError`.
 *
 * An error class of your own that has these members is read exactly like an
 * `HttpError`, without extending it. Check the shape at compile time with a type-only
 * import, which adds no runtime dependency:
 *
 * ```ts
 * import type { HttpErrorLike } from "@marianmeres/http-utils";
 *
 * class ApiError extends Error {
 *   status: number;
 *   body: unknown;
 *   // ...
 * }
 * // a compile error the day the two shapes drift apart
 * null as unknown as ApiError satisfies HttpErrorLike;
 * ```
 */
export interface HttpErrorLike {
	/** The error's own sentence. */
	message: string;
	/** The HTTP status of the response. */
	status: number;
	/** The response body: parsed JSON when it parsed, its text otherwise, or `null`. */
	body: unknown;
	/** The response as an RFC 9457 Problem Details document. */
	problem?: { type: string; title: string; status: number; detail?: string };
	/** The request method. */
	method?: string;
	/** The request URL. */
	url?: string;
}

/**
 * Records where an error came from. For the `HttpApi` client, which is the one place
 * that has the request and the response in hand.
 *
 * @internal
 */
export function _attachRequest(
	error: HttpError,
	context: { method: string; url: string; mediaType?: string | null },
): void {
	error.method = context.method;
	error.url = context.url;
	if (context.mediaType) _mediaTypes.set(error, context.mediaType);
}

const _wellKnownCtorMap = {
	"400": BadRequest,
	"401": Unauthorized,
	"403": Forbidden,
	"404": NotFound,
	"405": MethodNotAllowed,
	"408": RequestTimeout,
	"409": Conflict,
	"410": Gone,
	"411": LengthRequired,
	"418": ImATeapot,
	"422": UnprocessableContent,
	"429": TooManyRequests,
	//
	"500": InternalServerError,
	"501": NotImplemented,
	"502": BadGateway,
	"503": ServiceUnavailable,
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
	body?: unknown,
	cause?: unknown,
): HttpError => {
	const fallback = HTTP_STATUS.ERROR_SERVER.INTERNAL_SERVER_ERROR;

	code = Number(code);
	if (isNaN(code) || !(code >= 400 && code < 600)) code = fallback.CODE;

	// opinionated conventions
	body = maybeJsonParse(body);
	cause = maybeJsonParse(cause);

	// try to find the well known one, otherwise fallback to generic
	const ctor =
		_wellKnownCtorMap[`${code}` as keyof typeof _wellKnownCtorMap] ?? HttpError;

	//
	const found = HTTP_STATUS.findByCode(code);
	const statusText = found?.TEXT ?? fallback.TEXT;

	//
	const e = new ctor(message || statusText, { cause });
	e.status = found?.CODE ?? fallback.CODE;
	e.statusText = statusText;
	e.body = body;

	return e;
};

/** The text an object describes itself with, unless it is the default `[object X]`. */
function ownToStringOf(value: Record<string, unknown>): string | undefined {
	if (typeof value?.toString !== "function") return undefined;
	const text = textOf(value.toString());
	return text === undefined || /^\[object [^\]]*\]$/.test(text) ? undefined : text;
}

/** The sentence of a typed problem document: its `detail`, then its `title`. */
function typedProblemMessageOf(problem: unknown): string | undefined {
	const p = recordOf(problem);
	if (!p || typeof p.type !== "string" || p.type === "" || p.type === ABOUT_BLANK) {
		return undefined;
	}
	return textOf(p.detail) ?? textOf(p.title);
}

/**
 * Extracts a human-readable error message from various error formats.
 * Tries multiple strategies to find the best message, with fallbacks.
 *
 * Priority order:
 * 1. e.problem.detail / e.problem.title, when the error carries a typed RFC 9457
 *    problem document (a `problem.type` other than `"about:blank"`). Such an error
 *    speaks for itself, so its sentence wins over its `cause`.
 * 2. e.cause.message / e.cause.code / e.cause (if string)
 *    / e.cause.detail (RFC 9457) / e.cause.error_description (OAuth 2)
 *    / e.cause.error.error_description / e.cause.error.detail
 * 3. the sentence in e.body (see `getBodyMessage`): a problem document's detail
 *    / e.body.error.message / e.body.message
 *    / e.body.error.error_description / e.body.error.detail
 *    / e.body.detail (RFC 9457 / DRF / FastAPI) / e.body.title (RFC 9457)
 *    / e.body.error_description (OAuth 2)
 *    / e.body.errors[0] (JSON:API; first entry's detail/title/message, or string)
 *    / e.body.error (if string) / e.body (if plain text)
 * 4. e.message
 * 5. e.code (Node.js: ECONNREFUSED, ENOENT, ...)
 * 6. e.name
 * 7. e.toString()
 * 8. "Unknown Error"
 *
 * Only a non-blank string (or a number) counts at any step: an object or an array
 * found where a sentence was expected is skipped, never rendered as
 * `"[object Object]"`. A body that is markup (an HTML error page) is not a message,
 * and a plain-text one is cut at 500 characters.
 *
 * Works on any object of the {@link HttpErrorLike} shape, not only on this package's
 * own `HttpError`.
 *
 * @param e - The error to extract a message from (can be any type).
 * @param stripErrorPrefix - Whether to remove "Error: " prefix from the message (default: true).
 *
 * @returns A human-readable error message string.
 */
export const getErrorMessage = (e: unknown, stripErrorPrefix = true): string => {
	if (!e) return "";

	// Errors may bubble from various sources which are not always under control.
	// We try our best to extract a meaningful message using common conventions.
	const err = e as Record<string, unknown>;
	const cause = maybeJsonParse(err?.cause);
	const causeRecord = recordOf(cause);
	const causeError = recordOf(causeRecord?.error);

	let msg: string =
		// A typed problem document is the error's own, complete statement. Its
		// `cause` is what lies underneath (a driver error, the request context),
		// and must not replace the sentence the producer chose to give.
		typedProblemMessageOf(err?.problem) ??
		// https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Error/cause
		// For every other error, e.cause is the standard prop for error details, so
		// it is considered the most authoritative (if available).
		// "code" and "message" are my own conventions
		textOf(causeRecord?.message) ??
		textOf(causeRecord?.code) ??
		(typeof cause === "string" ? textOf(cause) : undefined) ??
		// additional well-known cause shapes (RFC 9457, OAuth 2, nested OAuth)
		textOf(causeRecord?.detail) ??
		textOf(causeRecord?.error_description) ??
		textOf(causeError?.error_description) ??
		textOf(causeError?.detail) ??
		// non-standard "body" is this package's HttpError prop
		getBodyMessage(err?.body) ??
		// the common message from Error ctor (e.g. "Foo" if new TypeError("Foo"))
		textOf(err?.message) ??
		// Node.js error code fallback (e.g. "ECONNREFUSED") when message is empty
		textOf(err?.code) ??
		// the Error class name (e.g. TypeError)
		textOf(err?.name) ??
		// this should handle (almost) everything else (mainly if e is not an Error instance)
		ownToStringOf(err) ??
		// very last fallback if `toString()` was not available (or said nothing)
		"Unknown Error";

	if (stripErrorPrefix) {
		msg = msg.replace(/^[^:]*Error: /i, "");
	}

	return msg;
};
