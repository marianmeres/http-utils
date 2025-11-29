import { createHttpError } from './error.js';
// This is an opinionated HTTP client wrapper and may not be suitable for every use case.
// It provides convenient defaults over plain fetch calls without adding unnecessary abstractions.
/**
 * Deep merges two objects. Later properties overwrite earlier properties.
 */
function deepMerge(target, source) {
    const output = { ...target };
    if (isObject(target) && isObject(source)) {
        Object.keys(source).forEach(key => {
            if (isObject(source[key])) {
                if (!(key in target)) {
                    Object.assign(output, { [key]: source[key] });
                }
                else {
                    output[key] = deepMerge(target[key], source[key]);
                }
            }
            else {
                Object.assign(output, { [key]: source[key] });
            }
        });
    }
    return output;
}
function isObject(item) {
    return item && typeof item === 'object' && !Array.isArray(item);
}
const _fetchRaw = async ({ method, path, data = null, token = null, headers = null, signal, credentials, }) => {
    const normalizedHeaders = Object.entries(headers || {}).reduce((m, [k, v]) => ({ ...m, [k.toLowerCase()]: v }), {});
    const opts = {
        method,
        credentials: credentials ?? undefined,
        headers: normalizedHeaders,
        signal
    };
    if (data) {
        const isObj = typeof data === 'object';
        // FormData: multipart/form-data -- no explicit Content-Type
        if (data instanceof FormData) {
            opts.body = data;
        }
        // Cover 99% of use cases (may not fit all scenarios)
        else {
            // If not explicitly stated, assume JSON
            if (isObj || !normalizedHeaders['content-type']) {
                normalizedHeaders['content-type'] = 'application/json';
            }
            opts.body = JSON.stringify(data);
        }
    }
    // Opinionated convention: auto-add Bearer token
    if (token) {
        normalizedHeaders['authorization'] = `Bearer ${token}`;
    }
    opts.headers = normalizedHeaders;
    return await fetch(path, opts);
};
const _fetch = async (params, respHeaders = null, errorMessageExtractor = null, _dumpParams = false) => {
    if (_dumpParams)
        return params;
    const r = await _fetchRaw(params);
    if (params.raw)
        return r;
    // Convert Headers to plain object
    const headers = [...r.headers.entries()].reduce((m, [k, v]) => ({ ...m, [k]: v }), {});
    // Mutate respHeaders to provide access to response headers and status
    if (respHeaders) {
        Object.assign(respHeaders, headers, 
        // Add status/text under special keys
        { __http_status_code__: r.status, __http_status_text__: r.statusText });
    }
    let body = await r.text();
    // prettier-ignore
    try {
        body = JSON.parse(body);
    }
    catch (_e) { /* ignore parse errors */ }
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
                    _body?.error ||
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
export function createHttpApi(base, defaults, factoryErrorMessageExtractor) {
    const _merge = (a, b) => {
        return deepMerge(a, b);
    };
    const _getDefs = async () => {
        if (typeof defaults === 'function') {
            return { ...(await defaults()) };
        }
        return { ...(defaults || {}) };
    };
    const _buildPath = (path, base) => {
        base = `${base || ''}`;
        path = `${path || ''}`;
        return /^https?:/.test(path) ? path : base + path;
    };
    return {
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
        async get(path, paramsOrOptions, respHeaders, errorMessageExtractor, _dumpParams = false) {
            // Detect which API is being used
            let params;
            let headers = null;
            let extractor = null;
            if (paramsOrOptions && ('respHeaders' in paramsOrOptions || 'errorExtractor' in paramsOrOptions)) {
                // New options API
                const opts = paramsOrOptions;
                params = opts.params;
                headers = opts.respHeaders ?? null;
                extractor = opts.errorExtractor ?? null;
            }
            else {
                // Legacy positional API
                params = paramsOrOptions;
                headers = respHeaders ?? null;
                extractor = errorMessageExtractor ?? null;
            }
            path = _buildPath(path, base);
            return _fetch(_merge(await _getDefs(), { ...params, method: 'GET', path }), headers, extractor ?? factoryErrorMessageExtractor, _dumpParams);
        },
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
        async post(path, dataOrOptions, params, respHeaders, errorMessageExtractor, _dumpParams = false) {
            // Detect which API is being used
            let data = null;
            let fetchParams;
            let headers = null;
            let extractor = null;
            if (dataOrOptions && ('data' in dataOrOptions ||
                'params' in dataOrOptions ||
                'respHeaders' in dataOrOptions ||
                'errorExtractor' in dataOrOptions)) {
                // New options API
                const opts = dataOrOptions;
                data = opts.data ?? null;
                fetchParams = opts.params;
                headers = opts.respHeaders ?? null;
                extractor = opts.errorExtractor ?? null;
            }
            else {
                // Legacy positional API
                data = dataOrOptions ?? null;
                fetchParams = params;
                headers = respHeaders ?? null;
                extractor = errorMessageExtractor ?? null;
            }
            path = _buildPath(path, base);
            return _fetch(_merge(await _getDefs(), { ...(fetchParams || {}), data, method: 'POST', path }), headers, extractor ?? factoryErrorMessageExtractor, _dumpParams);
        },
        /**
         * Performs a PUT request. Supports both new options API and legacy positional API.
         * @see post for usage examples
         */
        async put(path, dataOrOptions, params, respHeaders, errorMessageExtractor, _dumpParams = false) {
            // Detect which API is being used (same logic as POST)
            let data = null;
            let fetchParams;
            let headers = null;
            let extractor = null;
            if (dataOrOptions && ('data' in dataOrOptions ||
                'params' in dataOrOptions ||
                'respHeaders' in dataOrOptions ||
                'errorExtractor' in dataOrOptions)) {
                const opts = dataOrOptions;
                data = opts.data ?? null;
                fetchParams = opts.params;
                headers = opts.respHeaders ?? null;
                extractor = opts.errorExtractor ?? null;
            }
            else {
                data = dataOrOptions ?? null;
                fetchParams = params;
                headers = respHeaders ?? null;
                extractor = errorMessageExtractor ?? null;
            }
            path = _buildPath(path, base);
            return _fetch(_merge(await _getDefs(), { ...(fetchParams || {}), data, method: 'PUT', path }), headers, extractor ?? factoryErrorMessageExtractor, _dumpParams);
        },
        /**
         * Performs a PATCH request. Supports both new options API and legacy positional API.
         * @see post for usage examples
         */
        async patch(path, dataOrOptions, params, respHeaders, errorMessageExtractor, _dumpParams = false) {
            // Detect which API is being used (same logic as POST)
            let data = null;
            let fetchParams;
            let headers = null;
            let extractor = null;
            if (dataOrOptions && ('data' in dataOrOptions ||
                'params' in dataOrOptions ||
                'respHeaders' in dataOrOptions ||
                'errorExtractor' in dataOrOptions)) {
                const opts = dataOrOptions;
                data = opts.data ?? null;
                fetchParams = opts.params;
                headers = opts.respHeaders ?? null;
                extractor = opts.errorExtractor ?? null;
            }
            else {
                data = dataOrOptions ?? null;
                fetchParams = params;
                headers = respHeaders ?? null;
                extractor = errorMessageExtractor ?? null;
            }
            path = _buildPath(path, base);
            return _fetch(_merge(await _getDefs(), { ...(fetchParams || {}), data, method: 'PATCH', path }), headers, extractor ?? factoryErrorMessageExtractor, _dumpParams);
        },
        /**
         * Performs a DELETE request. Supports both new options API and legacy positional API.
         * Note: Request body in DELETE is allowed per HTTP spec.
         * @see post for usage examples
         */
        async del(path, dataOrOptions, params, respHeaders, errorMessageExtractor, _dumpParams = false) {
            // Detect which API is being used (same logic as POST)
            let data = null;
            let fetchParams;
            let headers = null;
            let extractor = null;
            if (dataOrOptions && ('data' in dataOrOptions ||
                'params' in dataOrOptions ||
                'respHeaders' in dataOrOptions ||
                'errorExtractor' in dataOrOptions)) {
                const opts = dataOrOptions;
                data = opts.data ?? null;
                fetchParams = opts.params;
                headers = opts.respHeaders ?? null;
                extractor = opts.errorExtractor ?? null;
            }
            else {
                data = dataOrOptions ?? null;
                fetchParams = params;
                headers = respHeaders ?? null;
                extractor = errorMessageExtractor ?? null;
            }
            path = _buildPath(path, base);
            return _fetch(_merge(await _getDefs(), { ...(fetchParams || {}), data, method: 'DELETE', path }), headers, extractor ?? factoryErrorMessageExtractor, _dumpParams);
        },
        /**
         * Helper method to build the full URL from a path.
         *
         * @param path - The path to resolve (absolute URLs are returned as-is).
         * @returns The resolved URL (base + path, or just path if it's already absolute).
         */
        url: (path) => _buildPath(path, base),
        /**
         * Get or set the base URL for all requests.
         */
        get base() {
            return base;
        },
        set base(v) {
            base = v;
        },
    };
}
createHttpApi.defaultErrorMessageExtractor = null;
