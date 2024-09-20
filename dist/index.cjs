'use strict';

var merge = require('dset/merge');

// prettier-ignore
class HTTP_STATUS {
    // full db
    // 1xx
    static INFO = {
        CONTINUE: { CODE: 100, TEXT: 'Continue' },
        SWITCHING_PROTOCOLS: { CODE: 101, TEXT: 'Switching Protocols' },
        PROCESSING: { CODE: 102, TEXT: 'Processing' },
        EARLY_HINTS: { CODE: 103, TEXT: 'Early Hints' },
    };
    // 2xx
    static SUCCESS = {
        OK: { CODE: 200, TEXT: 'OK' },
        CREATED: { CODE: 201, TEXT: 'Created' },
        ACCEPTED: { CODE: 202, TEXT: 'Accepted' },
        NON_AUTHORITATIVE_INFO: { CODE: 203, TEXT: 'Non-Authoritative Information' },
        NO_CONTENT: { CODE: 204, TEXT: 'No Content' },
        RESET_CONTENT: { CODE: 205, TEXT: 'Reset Content' },
        PARTIAL_CONTENT: { CODE: 206, TEXT: 'Partial Content' },
        MULTI_STATUS: { CODE: 207, TEXT: 'Multi-Status' },
        ALREADY_REPORTED: { CODE: 208, TEXT: 'Already Reported' },
        IM_USED: { CODE: 226, TEXT: 'IM Used' }, // ?
    };
    // 3xx
    static REDIRECT = {
        MUTLIPLE_CHOICES: { CODE: 300, TEXT: 'Multiple Choices' },
        MOVED_PERMANENTLY: { CODE: 301, TEXT: 'Moved Permanently' },
        FOUND: { CODE: 302, TEXT: 'Found' },
        SEE_OTHER: { CODE: 303, TEXT: 'See Other' },
        NOT_MODIFIED: { CODE: 304, TEXT: 'Not Modified' },
        TEMPORARY_REDIRECT: { CODE: 307, TEXT: 'Temporary Redirect' },
        PERMANENT_REDIRECT: { CODE: 308, TEXT: 'Permanent Redirect' },
    };
    // 4xx
    static ERROR_CLIENT = {
        BAD_REQUEST: { CODE: 400, TEXT: 'Bad Request' },
        UNAUTHORIZED: { CODE: 401, TEXT: 'Unauthorized' },
        PAYMENT_REQUIRED_EXPERIMENTAL: { CODE: 402, TEXT: 'Payment Required Experimental' },
        FORBIDDEN: { CODE: 403, TEXT: 'Forbidden' },
        NOT_FOUND: { CODE: 404, TEXT: 'Not Found' },
        METHOD_NOT_ALLOWED: { CODE: 405, TEXT: 'Method Not Allowed' },
        NOT_ACCEPTABLE: { CODE: 406, TEXT: 'Not Acceptable' },
        PROXY_AUTHENTICATION_REQUIRED: { CODE: 407, TEXT: 'Proxy Authentication Required' },
        REQUEST_TIMEOUT: { CODE: 408, TEXT: 'Request Timeout' },
        CONFLICT: { CODE: 409, TEXT: 'Conflict' },
        GONE: { CODE: 410, TEXT: 'Gone' },
        LENGTH_REQUIRED: { CODE: 411, TEXT: 'Length Required' },
        PRECONDITION_FAILED: { CODE: 412, TEXT: 'Precondition Failed' },
        PAYLOAD_TOO_LARGE: { CODE: 413, TEXT: 'Payload Too Large' },
        URI_TOO_LONG: { CODE: 414, TEXT: 'URI Too Long' },
        UNSUPPORTED_MEDIA_TYPE: { CODE: 415, TEXT: 'Unsupported Media Type' },
        RANGE_NOT_SATISFIABLE: { CODE: 416, TEXT: 'Range Not Satisfiable' },
        EXPECTATION_FAILED: { CODE: 417, TEXT: 'Expectation Failed' },
        IM_A_TEAPOT: { CODE: 418, TEXT: "I'm a teapot" },
        MISDIRECTED_REQUEST: { CODE: 421, TEXT: 'Misdirected Request' },
        UNPROCESSABLE_CONTENT: { CODE: 422, TEXT: 'Unprocessable Content' },
        LOCKED: { CODE: 423, TEXT: 'Locked' },
        FAILED_DEPENDENCY: { CODE: 424, TEXT: 'Failed Dependency' },
        TOO_EARLY_EXPERIMENTAL: { CODE: 425, TEXT: 'Too Early Experimental' },
        UPGRADE_REQUIRED: { CODE: 426, TEXT: 'Upgrade Required' },
        PRECONDITION_REQUIRED: { CODE: 428, TEXT: 'Precondition Required' },
        TOO_MANY_REQUESTS: { CODE: 429, TEXT: 'Too Many Requests' },
        REQUEST_HEADER_FIELDS_TOO_LARGE: { CODE: 431, TEXT: 'Request Header Fields Too Large' },
        UNAVAILABLE_FOR_LEGAL_REASONS: { CODE: 451, TEXT: 'Unavailable For Legal Reasons' },
    };
    // 5xx
    // prettier-ignore
    static ERROR_SERVER = {
        INTERNAL_SERVER_ERROR: { CODE: 500, TEXT: 'Internal Server Error' },
        NOT_IMPLEMENTED: { CODE: 501, TEXT: 'Not Implemented' },
        BAD_GATEWAY: { CODE: 502, TEXT: 'Bad Gateway' },
        SERVICE_UNAVAILABLE: { CODE: 503, TEXT: 'Service Unavailable' },
        GATEWAY_TIMEOUT: { CODE: 504, TEXT: 'Gateway Timeout' },
        HTTP_VERSION_NOT_SUPPORTED: { CODE: 505, TEXT: 'HTTP Version Not Supported' },
        VARIANT_ALSO_NEGOTIATES: { CODE: 506, TEXT: 'Variant Also Negotiates' },
        INSUFFICIENT_STORAGE: { CODE: 507, TEXT: 'Insufficient Storage' },
        LOOP_DETECTED: { CODE: 508, TEXT: 'Loop Detected' },
        NOT_EXTENDED: { CODE: 510, TEXT: 'Not Extended' },
        NETWORK_AUTH_REQUIRED: { CODE: 511, TEXT: 'Network Authentication Required' },
    };
    // few hand picked direct code shortcuts
    // 2xx
    static OK = HTTP_STATUS.SUCCESS.OK.CODE;
    static CREATED = HTTP_STATUS.SUCCESS.CREATED.CODE;
    static ACCEPTED = HTTP_STATUS.SUCCESS.ACCEPTED.CODE;
    static NO_CONTENT = HTTP_STATUS.SUCCESS.NO_CONTENT.CODE;
    // 3xx
    static MUTLIPLE_CHOICES = HTTP_STATUS.REDIRECT.MUTLIPLE_CHOICES.CODE;
    static FOUND = HTTP_STATUS.REDIRECT.FOUND.CODE;
    static NOT_MODIFIED = HTTP_STATUS.REDIRECT.NOT_MODIFIED.CODE;
    static MOVED_PERMANENTLY = HTTP_STATUS.REDIRECT.MOVED_PERMANENTLY.CODE;
    static TEMPORARY_REDIRECT = HTTP_STATUS.REDIRECT.TEMPORARY_REDIRECT.CODE;
    static PERMANENT_REDIRECT = HTTP_STATUS.REDIRECT.PERMANENT_REDIRECT.CODE;
    // 4xx
    static BAD_REQUEST = HTTP_STATUS.ERROR_CLIENT.BAD_REQUEST.CODE;
    static UNAUTHORIZED = HTTP_STATUS.ERROR_CLIENT.UNAUTHORIZED.CODE;
    static FORBIDDEN = HTTP_STATUS.ERROR_CLIENT.FORBIDDEN.CODE;
    static NOT_FOUND = HTTP_STATUS.ERROR_CLIENT.NOT_FOUND.CODE;
    static METHOD_NOT_ALLOWED = HTTP_STATUS.ERROR_CLIENT.METHOD_NOT_ALLOWED.CODE;
    static CONFLICT = HTTP_STATUS.ERROR_CLIENT.CONFLICT.CODE;
    static GONE = HTTP_STATUS.ERROR_CLIENT.GONE.CODE;
    static UNPROCESSABLE_CONTENT = HTTP_STATUS.ERROR_CLIENT.UNPROCESSABLE_CONTENT.CODE;
    // 5xx
    static INTERNAL_SERVER_ERROR = HTTP_STATUS.ERROR_SERVER.INTERNAL_SERVER_ERROR.CODE;
    static NOT_IMPLEMENTED = HTTP_STATUS.ERROR_SERVER.NOT_IMPLEMENTED.CODE;
    static SERVICE_UNAVAILABLE = HTTP_STATUS.ERROR_SERVER.SERVICE_UNAVAILABLE.CODE;
    //
    static findByCode(code) {
        const keys = [
            'INFO', 'SUCCESS', 'REDIRECT', 'ERROR_CLIENT', 'ERROR_SERVER',
        ];
        for (const _TYPE of keys) {
            for (const [_KEY, data] of Object.entries(HTTP_STATUS[_TYPE])) {
                if (data.CODE == code) {
                    return { ...data, _TYPE, _KEY };
                }
            }
        }
        return null;
    }
}

// opinionated base for all
class HttpError extends Error {
    name = 'HttpError';
    // props simulating fetch Response
    status = HTTP_STATUS.ERROR_SERVER.INTERNAL_SERVER_ERROR.CODE;
    statusText = HTTP_STATUS.ERROR_SERVER.INTERNAL_SERVER_ERROR.TEXT;
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
class UnprocessableContent extends HttpError {
    name = 'HttpUnprocessableContentError';
    status = HTTP_STATUS.ERROR_CLIENT.UNPROCESSABLE_CONTENT.CODE;
    statusText = HTTP_STATUS.ERROR_CLIENT.UNPROCESSABLE_CONTENT.TEXT;
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
//
const HTTP_ERROR = {
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
const _maybeJsonParse = (v) => {
    if (typeof v === 'string') {
        try {
            v = JSON.parse(v);
        }
        catch (e) { }
    }
    return v;
};
const createHttpError = (code, message, 
// arbitrary content, typically http response body which threw this error
// (will be JSON.parse-d if the content is a valid json string)
body, 
// https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Error/cause
// arbitrary details, typically response text (will be JSON.parse-d if the content is a valid json string)
cause) => {
    const fallback = HTTP_STATUS.ERROR_SERVER.INTERNAL_SERVER_ERROR;
    code = Number(code);
    if (isNaN(code) || !(code >= 400 && code < 600))
        code = fallback.CODE;
    // opinionated convention
    body = _maybeJsonParse(body);
    // opinionated convention
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
const getErrorMessage = (e, stripErrorPrefix = true) => {
    if (!e)
        return '';
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

const _fetchRaw = async ({ method, path, data = null, token = null, headers = null, signal = null, credentials, }) => {
    headers = Object.entries(headers || {}).reduce((m, [k, v]) => ({ ...m, [k.toLowerCase()]: v }), {});
    const opts = { method, credentials, headers, signal };
    if (data) {
        const isObj = typeof data === 'object';
        // multipart/form-data -- no explicit Content-Type
        if (data instanceof FormData) {
            opts.body = data;
        }
        // cover 99% use cases (may not fit all)
        else {
            // if not stated, assuming json
            if (isObj || !headers['content-type']) {
                opts.headers['content-type'] = 'application/json';
            }
            opts.body = JSON.stringify(data);
        }
    }
    // opinionated convention
    if (token) {
        opts.headers['authorization'] = `Bearer ${token}`;
    }
    return await fetch(path, opts);
};
const _fetch = async (params, respHeaders = null, errorMessageExtractor = null, _dumpParams = false) => {
    if (_dumpParams)
        return params;
    const r = await _fetchRaw(params);
    if (params.raw)
        return r;
    //
    const headers = [...r.headers.entries()].reduce((m, [k, v]) => ({ ...m, [k]: v }), {});
    // quick-n-dirty reference to headers (so it's still accessible over this api wrap)
    if (respHeaders) {
        Object.assign(respHeaders, { ...headers }, 
        // adding status/text under special keys
        { __http_status_code__: r.status, __http_status_text__: r.statusText });
    }
    let body = await r.text();
    // prettier-ignore
    try {
        body = JSON.parse(body);
    }
    catch (e) { }
    params.assert ??= true; // default is true
    if (!r.ok && params.assert) {
        // now we need to extract error message from an unknown response... this is obviously
        // impossible unless we know what to expect, but we'll do some educated tries...
        const extractor = errorMessageExtractor ?? // provided arg
            createHttpApi.defaultErrorMessageExtractor ?? // static default
            // educated guess fallback
            function (_body, _response) {
                let msg = 
                // try opinionated convention first
                _body?.error?.message ||
                    _body?.message ||
                    _response?.statusText ||
                    'Unknown error';
                if (msg.length > 255)
                    msg = `[Shortened]: ${msg.slice(0, 255)}`;
                return msg;
            };
        // adding `cause` describing more details
        throw createHttpError(r.status, extractor(body, r), body, {
            method: params.method,
            path: params.path,
            response: {
                status: r.status,
                statusText: r.statusText,
                headers,
            },
        });
    }
    return body;
};
function createHttpApi(base, defaults, factoryErrorMessageExtractor) {
    const _merge = (a, b) => {
        const wrap = { result: a };
        merge.dset(wrap, 'result', b);
        return wrap.result;
    };
    const _getDefs = async () => new Promise(async (resolve) => {
        if (typeof defaults === 'function') {
            resolve({ ...(await defaults()) });
        }
        else {
            resolve({ ...(defaults || {}) });
        }
    });
    return {
        // GET
        async get(path, params, respHeaders = null, errorMessageExtractor = null, _dumpParams = false) {
            path = `${base || ''}${path || ''}`;
            return _fetch(_merge(await _getDefs(), { ...params, method: 'GET', path }), respHeaders, errorMessageExtractor ?? factoryErrorMessageExtractor, _dumpParams);
        },
        // POST
        async post(path, data = null, params, respHeaders = null, errorMessageExtractor = null, _dumpParams = false) {
            path = `${base || ''}${path || ''}`;
            return _fetch(_merge(await _getDefs(), { ...(params || {}), data, method: 'POST', path }), respHeaders, errorMessageExtractor ?? factoryErrorMessageExtractor, _dumpParams);
        },
        // PUT
        async put(path, data = null, params, respHeaders = null, errorMessageExtractor = null, _dumpParams = false) {
            path = `${base || ''}${path || ''}`;
            return _fetch(_merge(await _getDefs(), { ...(params || {}), data, method: 'PUT', path }), respHeaders, errorMessageExtractor ?? factoryErrorMessageExtractor, _dumpParams);
        },
        // PATCH
        async patch(path, data = null, params, respHeaders = null, errorMessageExtractor = null, _dumpParams = false) {
            path = `${base || ''}${path || ''}`;
            return _fetch(_merge(await _getDefs(), { ...(params || {}), data, method: 'PATCH', path }), respHeaders, errorMessageExtractor ?? factoryErrorMessageExtractor, _dumpParams);
        },
        // DELETE
        // https://stackoverflow.com/questions/299628/is-an-entity-body-allowed-for-an-http-delete-request
        async del(path, data = null, params, respHeaders = null, errorMessageExtractor = null, _dumpParams = false) {
            path = `${base || ''}${path || ''}`;
            return _fetch(_merge(await _getDefs(), { ...(params || {}), data, method: 'DELETE', path }), respHeaders, errorMessageExtractor ?? factoryErrorMessageExtractor, _dumpParams);
        },
    };
}
createHttpApi.defaultErrorMessageExtractor = null;

exports.HTTP_ERROR = HTTP_ERROR;
exports.HTTP_STATUS = HTTP_STATUS;
exports.createHttpApi = createHttpApi;
exports.createHttpError = createHttpError;
exports.getErrorMessage = getErrorMessage;
