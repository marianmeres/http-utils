export declare class HTTP_STATUS {
    static readonly INFO: {
        CONTINUE: {
            CODE: number;
            TEXT: string;
        };
        SWITCHING_PROTOCOLS: {
            CODE: number;
            TEXT: string;
        };
        PROCESSING: {
            CODE: number;
            TEXT: string;
        };
        EARLY_HINTS: {
            CODE: number;
            TEXT: string;
        };
    };
    static readonly SUCCESS: {
        OK: {
            CODE: number;
            TEXT: string;
        };
        CREATED: {
            CODE: number;
            TEXT: string;
        };
        ACCEPTED: {
            CODE: number;
            TEXT: string;
        };
        NON_AUTHORITATIVE_INFO: {
            CODE: number;
            TEXT: string;
        };
        NO_CONTENT: {
            CODE: number;
            TEXT: string;
        };
        RESET_CONTENT: {
            CODE: number;
            TEXT: string;
        };
        PARTIAL_CONTENT: {
            CODE: number;
            TEXT: string;
        };
        MULTI_STATUS: {
            CODE: number;
            TEXT: string;
        };
        ALREADY_REPORTED: {
            CODE: number;
            TEXT: string;
        };
        IM_USED: {
            CODE: number;
            TEXT: string;
        };
    };
    static readonly REDIRECT: {
        MUTLIPLE_CHOICES: {
            CODE: number;
            TEXT: string;
        };
        MOVED_PERMANENTLY: {
            CODE: number;
            TEXT: string;
        };
        FOUND: {
            CODE: number;
            TEXT: string;
        };
        SEE_OTHER: {
            CODE: number;
            TEXT: string;
        };
        NOT_MODIFIED: {
            CODE: number;
            TEXT: string;
        };
        TEMPORARY_REDIRECT: {
            CODE: number;
            TEXT: string;
        };
        PERMANENT_REDIRECT: {
            CODE: number;
            TEXT: string;
        };
    };
    static readonly ERROR_CLIENT: {
        BAD_REQUEST: {
            CODE: number;
            TEXT: string;
        };
        UNAUTHORIZED: {
            CODE: number;
            TEXT: string;
        };
        PAYMENT_REQUIRED_EXPERIMENTAL: {
            CODE: number;
            TEXT: string;
        };
        FORBIDDEN: {
            CODE: number;
            TEXT: string;
        };
        NOT_FOUND: {
            CODE: number;
            TEXT: string;
        };
        METHOD_NOT_ALLOWED: {
            CODE: number;
            TEXT: string;
        };
        NOT_ACCEPTABLE: {
            CODE: number;
            TEXT: string;
        };
        PROXY_AUTHENTICATION_REQUIRED: {
            CODE: number;
            TEXT: string;
        };
        REQUEST_TIMEOUT: {
            CODE: number;
            TEXT: string;
        };
        CONFLICT: {
            CODE: number;
            TEXT: string;
        };
        GONE: {
            CODE: number;
            TEXT: string;
        };
        LENGTH_REQUIRED: {
            CODE: number;
            TEXT: string;
        };
        PRECONDITION_FAILED: {
            CODE: number;
            TEXT: string;
        };
        PAYLOAD_TOO_LARGE: {
            CODE: number;
            TEXT: string;
        };
        URI_TOO_LONG: {
            CODE: number;
            TEXT: string;
        };
        UNSUPPORTED_MEDIA_TYPE: {
            CODE: number;
            TEXT: string;
        };
        RANGE_NOT_SATISFIABLE: {
            CODE: number;
            TEXT: string;
        };
        EXPECTATION_FAILED: {
            CODE: number;
            TEXT: string;
        };
        IM_A_TEAPOT: {
            CODE: number;
            TEXT: string;
        };
        MISDIRECTED_REQUEST: {
            CODE: number;
            TEXT: string;
        };
        UNPROCESSABLE_CONTENT: {
            CODE: number;
            TEXT: string;
        };
        LOCKED: {
            CODE: number;
            TEXT: string;
        };
        FAILED_DEPENDENCY: {
            CODE: number;
            TEXT: string;
        };
        TOO_EARLY_EXPERIMENTAL: {
            CODE: number;
            TEXT: string;
        };
        UPGRADE_REQUIRED: {
            CODE: number;
            TEXT: string;
        };
        PRECONDITION_REQUIRED: {
            CODE: number;
            TEXT: string;
        };
        TOO_MANY_REQUESTS: {
            CODE: number;
            TEXT: string;
        };
        REQUEST_HEADER_FIELDS_TOO_LARGE: {
            CODE: number;
            TEXT: string;
        };
        UNAVAILABLE_FOR_LEGAL_REASONS: {
            CODE: number;
            TEXT: string;
        };
    };
    static readonly ERROR_SERVER: {
        INTERNAL_SERVER_ERROR: {
            CODE: number;
            TEXT: string;
        };
        NOT_IMPLEMENTED: {
            CODE: number;
            TEXT: string;
        };
        BAD_GATEWAY: {
            CODE: number;
            TEXT: string;
        };
        SERVICE_UNAVAILABLE: {
            CODE: number;
            TEXT: string;
        };
        GATEWAY_TIMEOUT: {
            CODE: number;
            TEXT: string;
        };
        HTTP_VERSION_NOT_SUPPORTED: {
            CODE: number;
            TEXT: string;
        };
        VARIANT_ALSO_NEGOTIATES: {
            CODE: number;
            TEXT: string;
        };
        INSUFFICIENT_STORAGE: {
            CODE: number;
            TEXT: string;
        };
        LOOP_DETECTED: {
            CODE: number;
            TEXT: string;
        };
        NOT_EXTENDED: {
            CODE: number;
            TEXT: string;
        };
        NETWORK_AUTH_REQUIRED: {
            CODE: number;
            TEXT: string;
        };
    };
    static readonly OK: number;
    static readonly CREATED: number;
    static readonly ACCEPTED: number;
    static readonly NO_CONTENT: number;
    static readonly MUTLIPLE_CHOICES: number;
    static readonly FOUND: number;
    static readonly NOT_MODIFIED: number;
    static readonly MOVED_PERMANENTLY: number;
    static readonly TEMPORARY_REDIRECT: number;
    static readonly PERMANENT_REDIRECT: number;
    static readonly BAD_REQUEST: number;
    static readonly UNAUTHORIZED: number;
    static readonly FORBIDDEN: number;
    static readonly NOT_FOUND: number;
    static readonly METHOD_NOT_ALLOWED: number;
    static readonly CONFLICT: number;
    static readonly GONE: number;
    static readonly INTERNAL_SERVER_ERROR: number;
    static readonly NOT_IMPLEMENTED: number;
    static readonly SERVICE_UNAVAILABLE: number;
    static findByCode(code: number | string): {
        CODE: number;
        TEXT: string;
        _TYPE: string;
        _KEY: string;
    } | null;
}
