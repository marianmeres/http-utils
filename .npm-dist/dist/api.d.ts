interface BaseParams {
    method: 'GET' | 'POST' | 'PATCH' | 'DELETE' | 'PUT';
    path: string;
}
interface FetchParams {
    data?: any;
    token?: string | null;
    headers?: Record<string, string> | null;
    signal?: AbortSignal;
    credentials?: 'omit' | 'same-origin' | 'include' | null;
    raw?: boolean | null;
    assert?: boolean | null;
}
type BaseFetchParams = BaseParams & FetchParams;
type ErrorMessageExtractor = (body: any, response: Response) => string;
type ResponseHeaders = Record<string, string | number>;
/**
 * Options for HTTP GET requests (new cleaner API).
 */
export interface GetOptions {
    params?: FetchParams;
    respHeaders?: ResponseHeaders | null;
    errorExtractor?: ErrorMessageExtractor | null;
}
/**
 * Options for HTTP POST/PUT/PATCH/DELETE requests (new cleaner API).
 */
export interface DataOptions {
    data?: any;
    params?: FetchParams;
    respHeaders?: ResponseHeaders | null;
    errorExtractor?: ErrorMessageExtractor | null;
}
/**
 * Creates an HTTP API client with convenient defaults and error handling.
 *
 * @param base - Optional base URL to prepend to all requests. Can be changed later via the `base` property.
 * @param defaults - Optional default parameters to merge with each request. Can be an object or async function returning an object.
 * @param factoryErrorMessageExtractor - Optional function to extract error messages from failed responses.
 *
 * @returns An object with HTTP methods (get, post, put, patch, del) and utility methods (url, base).
 *
 * @example
 * ```ts
 * const api = createHttpApi('https://api.example.com', {
 *   headers: { 'Authorization': 'Bearer token' }
 * });
 *
 * const data = await api.get('/users');
 * await api.post('/users', { name: 'John' });
 * ```
 */
export declare function createHttpApi(base?: string | null, defaults?: Partial<BaseFetchParams> | (() => Promise<Partial<BaseFetchParams>>), factoryErrorMessageExtractor?: ErrorMessageExtractor | null | undefined): {
    /**
     * Performs a GET request.
     *
     * Supports two calling styles:
     * 1. New (recommended): `get(path, { params, respHeaders, errorExtractor })`
     * 2. Legacy: `get(path, params, respHeaders, errorExtractor)`
     *
     * @param path - The request path (will be appended to base URL if set).
     * @param paramsOrOptions - FetchParams object OR GetOptions object (new API).
     * @param respHeaders - (Legacy API) Optional object to be mutated with response headers.
     * @param errorMessageExtractor - (Legacy API) Optional custom error message extractor.
     * @param _dumpParams - Internal parameter for testing.
     *
     * @returns The response body (auto-parsed as JSON if possible), or Response if `raw: true`.
     * @throws {HttpError} When the response is not OK and `assert` is true (default).
     *
     * @example
     * ```ts
     * // New API (recommended)
     * const data = await api.get('/users', {
     *   params: { headers: { 'X-Custom': 'value' } },
     *   respHeaders: {}
     * });
     *
     * // Legacy API (still works)
     * const respHeaders = {};
     * const data = await api.get('/users', { headers: {} }, respHeaders);
     * ```
     */
    get(path: string, paramsOrOptions?: FetchParams | GetOptions, respHeaders?: ResponseHeaders | null, errorMessageExtractor?: ErrorMessageExtractor | null, _dumpParams?: boolean): Promise<any>;
    /**
     * Performs a POST request.
     *
     * Supports two calling styles:
     * 1. New (recommended): `post(path, { data, params, respHeaders, errorExtractor })`
     * 2. Legacy: `post(path, data, params, respHeaders, errorExtractor)`
     *
     * @param path - The request path (will be appended to base URL if set).
     * @param dataOrOptions - Request body OR DataOptions object (new API).
     * @param params - (Legacy API) Optional fetch parameters.
     * @param respHeaders - (Legacy API) Optional object to be mutated with response headers.
     * @param errorMessageExtractor - (Legacy API) Optional custom error message extractor.
     * @param _dumpParams - Internal parameter for testing.
     *
     * @returns The response body (auto-parsed as JSON if possible), or Response if `raw: true`.
     * @throws {HttpError} When the response is not OK and `assert` is true (default).
     *
     * @example
     * ```ts
     * // New API (recommended)
     * await api.post('/users', {
     *   data: { name: 'John' },
     *   params: { headers: { 'X-Custom': 'value' } },
     *   respHeaders: {}
     * });
     *
     * // Legacy API (still works)
     * const respHeaders = {};
     * await api.post('/users', { name: 'John' }, {}, respHeaders);
     * ```
     */
    post(path: string, dataOrOptions?: any | DataOptions, params?: FetchParams, respHeaders?: ResponseHeaders | null, errorMessageExtractor?: ErrorMessageExtractor | null, _dumpParams?: boolean): Promise<any>;
    /**
     * Performs a PUT request. Supports both new options API and legacy positional API.
     * @see post for usage examples
     */
    put(path: string, dataOrOptions?: any | DataOptions, params?: FetchParams, respHeaders?: ResponseHeaders | null, errorMessageExtractor?: ErrorMessageExtractor | null, _dumpParams?: boolean): Promise<any>;
    /**
     * Performs a PATCH request. Supports both new options API and legacy positional API.
     * @see post for usage examples
     */
    patch(path: string, dataOrOptions?: any | DataOptions, params?: FetchParams, respHeaders?: ResponseHeaders | null, errorMessageExtractor?: ErrorMessageExtractor | null, _dumpParams?: boolean): Promise<any>;
    /**
     * Performs a DELETE request. Supports both new options API and legacy positional API.
     * Note: Request body in DELETE is allowed per HTTP spec.
     * @see post for usage examples
     */
    del(path: string, dataOrOptions?: any | DataOptions, params?: FetchParams, respHeaders?: ResponseHeaders | null, errorMessageExtractor?: ErrorMessageExtractor | null, _dumpParams?: boolean): Promise<any>;
    /**
     * Helper method to build the full URL from a path.
     *
     * @param path - The path to resolve (absolute URLs are returned as-is).
     * @returns The resolved URL (base + path, or just path if it's already absolute).
     */
    url: (path: string) => string;
    /**
     * Get or set the base URL for all requests.
     */
    base: string | null | undefined;
};
export declare namespace createHttpApi {
    var defaultErrorMessageExtractor: ErrorMessageExtractor;
}
export {};
