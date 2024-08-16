import { HTTP_STATUS } from './status.js';

// opinionated base for all
class HttpError extends Error {
	public name = 'HttpError';
	public status = HTTP_STATUS.ERROR_SERVER.INTERNAL_SERVER_ERROR.CODE;
	public statusText = HTTP_STATUS.ERROR_SERVER.INTERNAL_SERVER_ERROR.TEXT;
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
	//
	'500': InternalServerError,
	'501': NotImplemented,
	'502': BadGateway,
	'503': ServiceUnavailable,
};

export const createHttpError = (
	code: number | string,
	message?: string | null,
	// https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Error/cause
	// arbitrary details, typically response text (will be JSON.parse-d if text is valid json string)
	cause?: any
) => {
	const fallback = HTTP_STATUS.ERROR_SERVER.INTERNAL_SERVER_ERROR;

	code = Number(code);
	if (isNaN(code) || !(code >= 400 && code < 600)) code = fallback.CODE;

	const found = HTTP_STATUS.findByCode(code);
	const statusText = found?.TEXT ?? fallback.TEXT;

	// opinionated convention
	if (typeof cause === 'string') {
		// prettier-ignore
		try { cause = JSON.parse(cause); } catch (e) {}
	}

	// try to find the well known one, otherwise fallback to generic
	const ctor =
		_wellKnownCtorMap[`${code}` as keyof typeof _wellKnownCtorMap] ?? HttpError;

	let e = new ctor(message || statusText, { cause });
	e.status = found?.CODE ?? fallback.CODE;
	e.statusText = statusText;

	return e;
};
