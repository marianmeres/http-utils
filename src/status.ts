// prettier-ignore
export class HTTP_STATUS {
	// full db

	// 1xx
	static readonly INFO = {
		CONTINUE:                        { CODE: 100, TEXT: 'Continue' },
		SWITCHING_PROTOCOLS:             { CODE: 101, TEXT: 'Switching Protocols' },
		PROCESSING:                      { CODE: 102, TEXT: 'Processing' },
		EARLY_HINTS:                     { CODE: 103, TEXT: 'Early Hints' },
	};

	// 2xx
	static readonly SUCCESS = {
		OK:                              { CODE: 200, TEXT: 'OK' },
		CREATED:                         { CODE: 201, TEXT: 'Created' },
		ACCEPTED:                        { CODE: 202, TEXT: 'Accepted' },
		NON_AUTHORITATIVE_INFO:          { CODE: 203, TEXT: 'Non-Authoritative Information' },
		NO_CONTENT:                      { CODE: 204, TEXT: 'No Content' },
		RESET_CONTENT:                   { CODE: 205, TEXT: 'Reset Content' },
		PARTIAL_CONTENT:                 { CODE: 206, TEXT: 'Partial Content' },
		MULTI_STATUS:                    { CODE: 207, TEXT: 'Multi-Status' },
		ALREADY_REPORTED:                { CODE: 208, TEXT: 'Already Reported' },
		IM_USED:                         { CODE: 226, TEXT: 'IM Used' }, // ?
	};

	// 3xx
	static readonly REDIRECT = {
		MUTLIPLE_CHOICES:                { CODE: 300, TEXT: 'Multiple Choices' },
		MOVED_PERMANENTLY:               { CODE: 301, TEXT: 'Moved Permanently' },
		FOUND:                           { CODE: 302, TEXT: 'Found' },
		SEE_OTHER:                       { CODE: 303, TEXT: 'See Other' },
		NOT_MODIFIED:                    { CODE: 304, TEXT: 'Not Modified' },
		TEMPORARY_REDIRECT:              { CODE: 307, TEXT: 'Temporary Redirect' },
		PERMANENT_REDIRECT:              { CODE: 308, TEXT: 'Permanent Redirect' },
	};

	// 4xx
	static readonly ERROR_CLIENT = {
		BAD_REQUEST:                     { CODE: 400, TEXT: 'Bad Request' },
		UNAUTHORIZED:                    { CODE: 401, TEXT: 'Unauthorized' },
		PAYMENT_REQUIRED_EXPERIMENTAL:   { CODE: 402, TEXT: 'Payment Required Experimental' },
		FORBIDDEN:                       { CODE: 403, TEXT: 'Forbidden' },
		NOT_FOUND:                       { CODE: 404, TEXT: 'Not Found' },
		METHOD_NOT_ALLOWED:              { CODE: 405, TEXT: 'Method Not Allowed' },
		NOT_ACCEPTABLE:                  { CODE: 406, TEXT: 'Not Acceptable' },
		PROXY_AUTHENTICATION_REQUIRED:   { CODE: 407, TEXT: 'Proxy Authentication Required' },
		REQUEST_TIMEOUT:                 { CODE: 408, TEXT: 'Request Timeout' },
		CONFLICT:                        { CODE: 409, TEXT: 'Conflict' },
		GONE:                            { CODE: 410, TEXT: 'Gone' },
		LENGTH_REQUIRED:                 { CODE: 411, TEXT: 'Length Required' },
		PRECONDITION_FAILED:             { CODE: 412, TEXT: 'Precondition Failed' },
		PAYLOAD_TOO_LARGE:               { CODE: 413, TEXT: 'Payload Too Large' },
		URI_TOO_LONG:                    { CODE: 414, TEXT: 'URI Too Long' },
		UNSUPPORTED_MEDIA_TYPE:          { CODE: 415, TEXT: 'Unsupported Media Type' },
		RANGE_NOT_SATISFIABLE:           { CODE: 416, TEXT: 'Range Not Satisfiable' },
		EXPECTATION_FAILED:              { CODE: 417, TEXT: 'Expectation Failed' },
		IM_A_TEAPOT:                     { CODE: 418, TEXT: "I'm a teapot" },
		MISDIRECTED_REQUEST:             { CODE: 421, TEXT: 'Misdirected Request' },
		UNPROCESSABLE_CONTENT:           { CODE: 422, TEXT: 'Unprocessable Content' },
		LOCKED:                          { CODE: 423, TEXT: 'Locked' },
		FAILED_DEPENDENCY:               { CODE: 424, TEXT: 'Failed Dependency' },
		TOO_EARLY_EXPERIMENTAL:          { CODE: 425, TEXT: 'Too Early Experimental' },
		UPGRADE_REQUIRED:                { CODE: 426, TEXT: 'Upgrade Required' },
		PRECONDITION_REQUIRED:           { CODE: 428, TEXT: 'Precondition Required' },
		TOO_MANY_REQUESTS:               { CODE: 429, TEXT: 'Too Many Requests' },
		REQUEST_HEADER_FIELDS_TOO_LARGE: { CODE: 431, TEXT: 'Request Header Fields Too Large' },
		UNAVAILABLE_FOR_LEGAL_REASONS:   { CODE: 451, TEXT: 'Unavailable For Legal Reasons' },
	};

	// 5xx
	// prettier-ignore
	static readonly ERROR_SERVER = {
		INTERNAL_SERVER_ERROR:           { CODE: 500, TEXT: 'Internal Server Error' },
		NOT_IMPLEMENTED:                 { CODE: 501, TEXT: 'Not Implemented' },
		BAD_GATEWAY:                     { CODE: 502, TEXT: 'Bad Gateway' },
		SERVICE_UNAVAILABLE:             { CODE: 503, TEXT: 'Service Unavailable' },
		GATEWAY_TIMEOUT:                 { CODE: 504, TEXT: 'Gateway Timeout' },
		HTTP_VERSION_NOT_SUPPORTED:      { CODE: 505, TEXT: 'HTTP Version Not Supported' },
		VARIANT_ALSO_NEGOTIATES:         { CODE: 506, TEXT: 'Variant Also Negotiates' },
		INSUFFICIENT_STORAGE:            { CODE: 507, TEXT: 'Insufficient Storage' },
		LOOP_DETECTED:                   { CODE: 508, TEXT: 'Loop Detected' },
		NOT_EXTENDED:                    { CODE: 510, TEXT: 'Not Extended' },
		NETWORK_AUTH_REQUIRED:           { CODE: 511, TEXT: 'Network Authentication Required' },
	};

	// few hand picked direct code shortcuts
	
	// 2xx
	static readonly OK                    = HTTP_STATUS.SUCCESS.OK.CODE;
	static readonly CREATED               = HTTP_STATUS.SUCCESS.CREATED.CODE;
	static readonly ACCEPTED              = HTTP_STATUS.SUCCESS.ACCEPTED.CODE;
	static readonly NO_CONTENT            = HTTP_STATUS.SUCCESS.NO_CONTENT.CODE;

	// 3xx
	static readonly MUTLIPLE_CHOICES      = HTTP_STATUS.REDIRECT.MUTLIPLE_CHOICES.CODE;
	static readonly FOUND                 = HTTP_STATUS.REDIRECT.FOUND.CODE;
	static readonly NOT_MODIFIED          = HTTP_STATUS.REDIRECT.NOT_MODIFIED.CODE;
	static readonly MOVED_PERMANENTLY     = HTTP_STATUS.REDIRECT.MOVED_PERMANENTLY.CODE;
	static readonly TEMPORARY_REDIRECT    = HTTP_STATUS.REDIRECT.TEMPORARY_REDIRECT.CODE;
	static readonly PERMANENT_REDIRECT    = HTTP_STATUS.REDIRECT.PERMANENT_REDIRECT.CODE;

	// 4xx
	static readonly BAD_REQUEST           = HTTP_STATUS.ERROR_CLIENT.BAD_REQUEST.CODE;
	static readonly UNAUTHORIZED          = HTTP_STATUS.ERROR_CLIENT.UNAUTHORIZED.CODE;
	static readonly FORBIDDEN             = HTTP_STATUS.ERROR_CLIENT.FORBIDDEN.CODE;
	static readonly NOT_FOUND             = HTTP_STATUS.ERROR_CLIENT.NOT_FOUND.CODE;
	static readonly METHOD_NOT_ALLOWED    = HTTP_STATUS.ERROR_CLIENT.METHOD_NOT_ALLOWED.CODE;
	static readonly CONFLICT              = HTTP_STATUS.ERROR_CLIENT.CONFLICT.CODE;
	static readonly GONE                  = HTTP_STATUS.ERROR_CLIENT.GONE.CODE;

	// 5xx
	static readonly INTERNAL_SERVER_ERROR = HTTP_STATUS.ERROR_SERVER.INTERNAL_SERVER_ERROR.CODE;
	static readonly NOT_IMPLEMENTED       = HTTP_STATUS.ERROR_SERVER.NOT_IMPLEMENTED.CODE;
	static readonly SERVICE_UNAVAILABLE   = HTTP_STATUS.ERROR_SERVER.SERVICE_UNAVAILABLE.CODE;

	//
	static findByCode(
		code: number | string
	): { CODE: number; TEXT: string; _TYPE: string; _KEY: string } | null {
		const keys: (keyof typeof HTTP_STATUS)[] = [
			'INFO', 'SUCCESS', 'REDIRECT', 'ERROR_CLIENT', 'ERROR_SERVER',
		];
		for (const _TYPE of keys) {
			for (const [_KEY, data] of Object.entries(HTTP_STATUS[_TYPE]) as any) {
				if (data.CODE == code) {
					return { ...data, _TYPE, _KEY };
				}
			}
		}
		return null;
	}
}
