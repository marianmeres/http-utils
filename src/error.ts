import { HTTP_STATUS } from './status.js';

// opinionated base for all
class HttpError extends Error {
	public name = 'HttpError';
	// props simulating fetch Response
	public status: number = HTTP_STATUS.ERROR_SERVER.INTERNAL_SERVER_ERROR.CODE;
	public statusText: string = HTTP_STATUS.ERROR_SERVER.INTERNAL_SERVER_ERROR.TEXT;
	public body: any = null;
}

// some more specific instances of the well known ones...

// client

class BadRequest extends HttpError {
	public name = 'HttpBadRequestError';
	public status = HTTP_STATUS.ERROR_CLIENT.BAD_REQUEST.CODE;
	public statusText = HTTP_STATUS.ERROR_CLIENT.BAD_REQUEST.TEXT;
}

class Unauthorized extends HttpError {
	public name = 'HttpUnauthorizedError';
	public status = HTTP_STATUS.ERROR_CLIENT.UNAUTHORIZED.CODE;
	public statusText = HTTP_STATUS.ERROR_CLIENT.UNAUTHORIZED.TEXT;
}

class Forbidden extends HttpError {
	public name = 'HttpForbiddenError';
	public status = HTTP_STATUS.ERROR_CLIENT.FORBIDDEN.CODE;
	public statusText = HTTP_STATUS.ERROR_CLIENT.FORBIDDEN.TEXT;
}

class NotFound extends HttpError {
	public name = 'HttpNotFoundError';
	public status = HTTP_STATUS.ERROR_CLIENT.NOT_FOUND.CODE;
	public statusText = HTTP_STATUS.ERROR_CLIENT.NOT_FOUND.TEXT;
}

class MethodNotAllowed extends HttpError {
	public name = 'HttpMethodNotAllowedError';
	public status = HTTP_STATUS.ERROR_CLIENT.METHOD_NOT_ALLOWED.CODE;
	public statusText = HTTP_STATUS.ERROR_CLIENT.METHOD_NOT_ALLOWED.TEXT;
}

class RequestTimeout extends HttpError {
	public name = 'HttpRequestTimeoutError';
	public status = HTTP_STATUS.ERROR_CLIENT.REQUEST_TIMEOUT.CODE;
	public statusText = HTTP_STATUS.ERROR_CLIENT.REQUEST_TIMEOUT.TEXT;
}

class Conflict extends HttpError {
	public name = 'HttpConflictError';
	public status = HTTP_STATUS.ERROR_CLIENT.CONFLICT.CODE;
	public statusText = HTTP_STATUS.ERROR_CLIENT.CONFLICT.TEXT;
}

class Gone extends HttpError {
	public name = 'HttpGoneError';
	public status = HTTP_STATUS.ERROR_CLIENT.GONE.CODE;
	public statusText = HTTP_STATUS.ERROR_CLIENT.GONE.TEXT;
}

class UnprocessableContent extends HttpError {
	public name = 'HttpUnprocessableContentError';
	public status = HTTP_STATUS.ERROR_CLIENT.UNPROCESSABLE_CONTENT.CODE;
	public statusText = HTTP_STATUS.ERROR_CLIENT.UNPROCESSABLE_CONTENT.TEXT;
}

class ImATeapot extends HttpError {
	public name = 'HttpImATeapotError';
	public status = HTTP_STATUS.ERROR_CLIENT.IM_A_TEAPOT.CODE;
	public statusText = HTTP_STATUS.ERROR_CLIENT.IM_A_TEAPOT.TEXT;
}

// server

class InternalServerError extends HttpError {
	public name = 'HttpInternalServerError';
}

class NotImplemented extends HttpError {
	public name = 'HttpServiceUnavailableError';
	public status = HTTP_STATUS.ERROR_SERVER.NOT_IMPLEMENTED.CODE;
	public statusText = HTTP_STATUS.ERROR_SERVER.NOT_IMPLEMENTED.TEXT;
}

class BadGateway extends HttpError {
	public name = 'HttpBadGatewayError';
	public status = HTTP_STATUS.ERROR_SERVER.BAD_GATEWAY.CODE;
	public statusText = HTTP_STATUS.ERROR_SERVER.BAD_GATEWAY.TEXT;
}

class ServiceUnavailable extends HttpError {
	public name = 'HttpServiceUnavailableError';
	public status = HTTP_STATUS.ERROR_SERVER.SERVICE_UNAVAILABLE.CODE;
	public statusText = HTTP_STATUS.ERROR_SERVER.SERVICE_UNAVAILABLE.TEXT;
}

//
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
	ImATeapot,
	UnprocessableContent,
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
	'418': ImATeapot,
	'422': UnprocessableContent,
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

export const createHttpError = (
	code: number | string,
	message?: string | null,
	// arbitrary content, typically http response body which threw this error
	// (will be JSON.parse-d if the content is a valid json string)
	body?: string | null,
	// https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Error/cause
	// arbitrary details, typically response text (will be JSON.parse-d if the content is a valid json string)
	cause?: any
) => {
	const fallback = HTTP_STATUS.ERROR_SERVER.INTERNAL_SERVER_ERROR;

	code = Number(code);
	if (isNaN(code) || !(code >= 400 && code < 600)) code = fallback.CODE;

	// opinionated convention
	body = _maybeJsonParse(body);

	// opinionated convention
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

export const getErrorMessage = (e: any, stripErrorPrefix = true): string => {
	if (!e) return '';

	// PROBLEM is that error may bubble from various sources which are not always under control
	// and even if they were it still may not be trivial to keep similar structure on each error boundary...
	// So, we'll just do what we can, it will not be perfect, but should handle most cases most of the time.

	// Also, I'm relying on some of my own opinionated conventions as well...
	const cause = _maybeJsonParse(e?.cause);
	const body = _maybeJsonParse(e?.body);

	let msg =
		// https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Error/cause
		// e.cause is the standard prop for error details, so should be considered as
		// the most authoritative (if available)
		// "code" and "message" are my own conventions
		cause?.code ||
		cause?.message ||
		(typeof cause === 'string' ? cause : null) ||
		// non-standard "body" is this package's HttpError prop
		body?.error?.message ||
		body?.message ||
		(typeof body === 'string' ? body : null) ||
		// the common message from Error ctor (e.g. "Foo" if new TypeError("Foo"))
		e?.message ||
		// the Error class name (e.g. TypeError)
		e?.name ||
		// this should handle (almost) everything else (mainly if e is not the Error instance)
		e?.toString() ||
		// very last fallback if `toString()` was not available (or returned empty)
		'Unknown Error';

	if (stripErrorPrefix) {
		msg = msg.replace(/^[^:]*Error: /, '');
	}

	return msg;
};
