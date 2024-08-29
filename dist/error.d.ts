declare class HttpError extends Error {
    name: string;
    status: number;
    statusText: string;
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
declare class UnprocessableContent extends HttpError {
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
    ImATeapot: typeof ImATeapot;
    UnprocessableContent: typeof UnprocessableContent;
    InternalServerError: typeof InternalServerError;
    NotImplemented: typeof NotImplemented;
    BadGateway: typeof BadGateway;
    ServiceUnavailable: typeof ServiceUnavailable;
};
export declare const createHttpError: (code: number | string, message?: string | null, body?: string | null, cause?: any) => BadRequest | Unauthorized | Forbidden | NotFound | MethodNotAllowed | RequestTimeout | Conflict | Gone | UnprocessableContent | ImATeapot | InternalServerError | NotImplemented | BadGateway | ServiceUnavailable;
export {};
