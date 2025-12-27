/**
 * @module api
 *
 * HTTP API client factory and related types.
 * Provides a convenient wrapper over the native `fetch` API with sensible defaults.
 */

import { createHttpError } from './error.ts';

/**
 * Request body data type.
 * Supports JSON-serializable objects, FormData for file uploads, or raw strings.
 */
export type RequestData = Record<string, unknown> | FormData | string | null;

/**
 * Deep merges two objects. Later properties overwrite earlier properties.
 */
function deepMerge<T = unknown>(target: Record<string, unknown>, source: Record<string, unknown>): T {
	const output = { ...target };

	if (isObject(target) && isObject(source)) {
		Object.keys(source).forEach(key => {
			const sourceVal = source[key];
			const targetVal = target[key];
			if (isObject(sourceVal)) {
				if (!(key in target) || !isObject(targetVal)) {
					Object.assign(output, { [key]: sourceVal });
				} else {
					output[key] = deepMerge(targetVal, sourceVal);
				}
			} else {
				Object.assign(output, { [key]: sourceVal });
			}
		});
	}

	return output as T;
}

function isObject(item: unknown): item is Record<string, unknown> {
	return item !== null && typeof item === 'object' && !Array.isArray(item);
}

interface BaseParams {
	method: 'GET' | 'POST' | 'PATCH' | 'DELETE' | 'PUT';
	path: string;
}

/**
 * Parameters for fetch requests.
 */
export interface FetchParams {
	/** Request body data (automatically JSON stringified unless FormData). */
	data?: RequestData;
	/** Bearer token (auto-adds `Authorization: Bearer {token}` header). */
	token?: string | null;
	/** Custom request headers. */
	headers?: Record<string, string> | null;
	/** AbortSignal for request cancellation. */
	signal?: AbortSignal;
	/** Credentials mode for the request. */
	credentials?: 'omit' | 'same-origin' | 'include' | null;
	/** If true, returns the raw Response object instead of parsed body. */
	raw?: boolean | null;
	/** If false, does not throw on HTTP errors (default: true). */
	assert?: boolean | null;
}

type BaseFetchParams = BaseParams & FetchParams;

/**
 * Function to extract error messages from failed HTTP responses.
 * @param body - The parsed response body.
 * @param response - The raw Response object.
 * @returns A human-readable error message string.
 */
export type ErrorMessageExtractor = (body: unknown, response: Response) => string;

/**
 * Object to receive response headers after a request completes.
 * Will be mutated to include all response headers plus special keys:
 * - `__http_status_code__`: The HTTP status code
 * - `__http_status_text__`: The HTTP status text
 */
export type ResponseHeaders = Record<string, string | number>;

/**
 * Options for HTTP GET requests using the new cleaner API.
 */
export interface GetOptions {
	/** Fetch parameters (headers, token, signal, credentials, raw, assert). */
	params?: FetchParams;
	/** Object to receive response headers (will be mutated). */
	respHeaders?: ResponseHeaders | null;
	/** Custom error message extractor for this request. */
	errorExtractor?: ErrorMessageExtractor | null;
}

/**
 * Options for HTTP POST/PUT/PATCH/DELETE requests using the new cleaner API.
 */
export interface DataOptions {
	/** Request body data. */
	data?: RequestData;
	/** Fetch parameters (headers, token, signal, credentials, raw, assert). */
	params?: FetchParams;
	/** Object to receive response headers (will be mutated). */
	respHeaders?: ResponseHeaders | null;
	/** Custom error message extractor for this request. */
	errorExtractor?: ErrorMessageExtractor | null;
}

const _fetchRaw = async ({
	method,
	path,
	data = null,
	token = null,
	headers = null,
	signal,
	credentials,
}: BaseFetchParams) => {
	const normalizedHeaders: Record<string, string> = Object.entries(headers || {}).reduce(
		(m, [k, v]) => ({ ...m, [k.toLowerCase()]: v }),
		{}
	);

	const opts: RequestInit = {
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

const _fetch = async (
	params: BaseFetchParams,
	respHeaders: ResponseHeaders | null = null,
	errorMessageExtractor: ErrorMessageExtractor | null | undefined = null,
	_dumpParams = false
) => {
	if (_dumpParams) return params;

	const r = await _fetchRaw(params);
	if (params.raw) return r;

	// Convert Headers to plain object
	const headers: ResponseHeaders = [...r.headers.entries()].reduce(
		(m, [k, v]) => ({ ...m, [k]: v }),
		{} as ResponseHeaders
	);

	// Mutate respHeaders to provide access to response headers and status
	if (respHeaders) {
		Object.assign(
			respHeaders,
			headers,
			// Add status/text under special keys
			{ __http_status_code__: r.status, __http_status_text__: r.statusText }
		);
	}

	let body: unknown = await r.text();
	// prettier-ignore
	try { body = JSON.parse(body as string); } catch (_e) { /* ignore parse errors */ }

	params.assert ??= true; // default is true

	if (!r.ok && params.assert) {
		// now we need to extract error message from an unknown response... this is obviously
		// impossible unless we know what to expect, but we'll do some educated tries...
		const extractor =
			errorMessageExtractor ?? // provided arg
			createHttpApi.defaultErrorMessageExtractor ?? // static default
			// educated guess fallback
			function (_body: unknown, _response: Response): string {
				const b = _body as Record<string, unknown> | null;
				let msg: string = String(
					// try opinionated convention first
					(b?.error as Record<string, unknown>)?.message ||
					b?.message ||
					b?.error ||
					_response?.statusText ||
					'Unknown error'
				);

				if (msg.length > 255) msg = `[Shortened]: ${msg.slice(0, 255)}`;

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
 * HTTP API client with convenient defaults and error handling.
 */
export class HttpApi {
	#base?: string | null;
	#defaults?: Partial<BaseFetchParams> | (() => Promise<Partial<BaseFetchParams>>);
	#factoryErrorMessageExtractor?: ErrorMessageExtractor | null | undefined;

	constructor(
		base?: string | null,
		defaults?: Partial<BaseFetchParams> | (() => Promise<Partial<BaseFetchParams>>),
		factoryErrorMessageExtractor?: ErrorMessageExtractor | null | undefined
	) {
		this.#base = base;
		this.#defaults = defaults;
		this.#factoryErrorMessageExtractor = factoryErrorMessageExtractor;
	}

	#merge<T = unknown>(a: Record<string, unknown>, b: Record<string, unknown>): T {
		return deepMerge<T>(a, b);
	}

	async #getDefs(): Promise<Partial<BaseFetchParams>> {
		if (typeof this.#defaults === 'function') {
			return { ...(await this.#defaults()) };
		}
		return { ...(this.#defaults || {}) };
	}

	#buildPath(path: string, base?: string | null): string {
		base = `${base || ''}`;
		path = `${path || ''}`;
		return /^https?:/.test(path) ? path : base + path;
	}

	/**
	 * Performs a GET request (new options API - recommended).
	 *
	 * @param path - The request path (will be appended to base URL if set).
	 * @param options - Request options object.
	 * @returns The response body (auto-parsed as JSON if possible), or Response if `raw: true`.
	 * @throws {HttpError} When the response is not OK and `assert` is true (default).
	 *
	 * @example
	 * ```ts
	 * const data = await api.get('/users', {
	 *   params: { headers: { 'X-Custom': 'value' } },
	 *   respHeaders: {}
	 * });
	 * ```
	 */
	async get<T = unknown>(path: string, options: GetOptions): Promise<T>;

	/**
	 * Performs a GET request (legacy API).
	 *
	 * @param path - The request path (will be appended to base URL if set).
	 * @param params - Optional fetch parameters.
	 * @param respHeaders - Optional object to be mutated with response headers.
	 * @param errorMessageExtractor - Optional custom error message extractor.
	 * @param _dumpParams - Internal parameter for testing.
	 * @returns The response body (auto-parsed as JSON if possible), or Response if `raw: true`.
	 * @throws {HttpError} When the response is not OK and `assert` is true (default).
	 */
	async get<T = unknown>(
		path: string,
		params?: FetchParams,
		respHeaders?: ResponseHeaders | null,
		errorMessageExtractor?: ErrorMessageExtractor | null,
		_dumpParams?: boolean
	): Promise<T>;

	async get(
		path: string,
		paramsOrOptions?: FetchParams | GetOptions,
		respHeaders?: ResponseHeaders | null,
		errorMessageExtractor?: ErrorMessageExtractor | null,
		_dumpParams = false
	): Promise<unknown> {
		// Detect which API is being used
		let params: FetchParams | undefined;
		let headers: ResponseHeaders | null = null;
		let extractor: ErrorMessageExtractor | null | undefined = null;

		if (paramsOrOptions && ('respHeaders' in paramsOrOptions || 'errorExtractor' in paramsOrOptions)) {
			// New options API
			const opts = paramsOrOptions as GetOptions;
			params = opts.params;
			headers = opts.respHeaders ?? null;
			extractor = opts.errorExtractor ?? null;
		} else {
			// Legacy positional API
			params = paramsOrOptions as FetchParams | undefined;
			headers = respHeaders ?? null;
			extractor = errorMessageExtractor ?? null;
		}

		path = this.#buildPath(path, this.#base);
		return _fetch(
			this.#merge(await this.#getDefs(), { ...params, method: 'GET', path }),
			headers,
			extractor ?? this.#factoryErrorMessageExtractor,
			_dumpParams
		);
	}

	/**
	 * Performs a POST request (new options API - recommended).
	 *
	 * @param path - The request path (will be appended to base URL if set).
	 * @param options - Request options object including data and params.
	 * @returns The response body (auto-parsed as JSON if possible), or Response if `raw: true`.
	 * @throws {HttpError} When the response is not OK and `assert` is true (default).
	 *
	 * @example
	 * ```ts
	 * await api.post('/users', {
	 *   data: { name: 'John' },
	 *   params: { headers: { 'X-Custom': 'value' } },
	 *   respHeaders: {}
	 * });
	 * ```
	 */
	async post<T = unknown>(path: string, options: DataOptions): Promise<T>;

	/**
	 * Performs a POST request (legacy API).
	 *
	 * @param path - The request path (will be appended to base URL if set).
	 * @param data - Request body data.
	 * @param params - Optional fetch parameters.
	 * @param respHeaders - Optional object to be mutated with response headers.
	 * @param errorMessageExtractor - Optional custom error message extractor.
	 * @param _dumpParams - Internal parameter for testing.
	 * @returns The response body (auto-parsed as JSON if possible), or Response if `raw: true`.
	 * @throws {HttpError} When the response is not OK and `assert` is true (default).
	 */
	async post<T = unknown>(
		path: string,
		data?: RequestData,
		params?: FetchParams,
		respHeaders?: ResponseHeaders | null,
		errorMessageExtractor?: ErrorMessageExtractor | null,
		_dumpParams?: boolean
	): Promise<T>;

	async post(
		path: string,
		dataOrOptions?: RequestData | DataOptions,
		params?: FetchParams,
		respHeaders?: ResponseHeaders | null,
		errorMessageExtractor?: ErrorMessageExtractor | null,
		_dumpParams = false
	): Promise<unknown> {
		// Detect which API is being used
		let data: RequestData = null;
		let fetchParams: FetchParams | undefined;
		let headers: ResponseHeaders | null = null;
		let extractor: ErrorMessageExtractor | null | undefined = null;

		if (
			dataOrOptions &&
			typeof dataOrOptions === 'object' &&
			!(dataOrOptions instanceof FormData) &&
			('data' in dataOrOptions ||
				'params' in dataOrOptions ||
				'respHeaders' in dataOrOptions ||
				'errorExtractor' in dataOrOptions)
		) {
			// New options API
			const opts = dataOrOptions as DataOptions;
			data = opts.data ?? null;
			fetchParams = opts.params;
			headers = opts.respHeaders ?? null;
			extractor = opts.errorExtractor ?? null;
		} else {
			// Legacy positional API
			data = (dataOrOptions as RequestData) ?? null;
			fetchParams = params;
			headers = respHeaders ?? null;
			extractor = errorMessageExtractor ?? null;
		}

		path = this.#buildPath(path, this.#base);
		return _fetch(
			this.#merge(await this.#getDefs(), { ...(fetchParams || {}), data, method: 'POST', path }),
			headers,
			extractor ?? this.#factoryErrorMessageExtractor,
			_dumpParams
		);
	}

	/** Performs a PUT request (new options API). @see post */
	async put<T = unknown>(path: string, options: DataOptions): Promise<T>;
	/** Performs a PUT request (legacy API). @see post */
	async put<T = unknown>(
		path: string,
		data?: RequestData,
		params?: FetchParams,
		respHeaders?: ResponseHeaders | null,
		errorMessageExtractor?: ErrorMessageExtractor | null,
		_dumpParams?: boolean
	): Promise<T>;
	async put(
		path: string,
		dataOrOptions?: RequestData | DataOptions,
		params?: FetchParams,
		respHeaders?: ResponseHeaders | null,
		errorMessageExtractor?: ErrorMessageExtractor | null,
		_dumpParams = false
	): Promise<unknown> {
		let data: RequestData = null;
		let fetchParams: FetchParams | undefined;
		let headers: ResponseHeaders | null = null;
		let extractor: ErrorMessageExtractor | null | undefined = null;

		if (
			dataOrOptions &&
			typeof dataOrOptions === 'object' &&
			!(dataOrOptions instanceof FormData) &&
			('data' in dataOrOptions ||
				'params' in dataOrOptions ||
				'respHeaders' in dataOrOptions ||
				'errorExtractor' in dataOrOptions)
		) {
			const opts = dataOrOptions as DataOptions;
			data = opts.data ?? null;
			fetchParams = opts.params;
			headers = opts.respHeaders ?? null;
			extractor = opts.errorExtractor ?? null;
		} else {
			data = (dataOrOptions as RequestData) ?? null;
			fetchParams = params;
			headers = respHeaders ?? null;
			extractor = errorMessageExtractor ?? null;
		}

		path = this.#buildPath(path, this.#base);
		return _fetch(
			this.#merge(await this.#getDefs(), { ...(fetchParams || {}), data, method: 'PUT', path }),
			headers,
			extractor ?? this.#factoryErrorMessageExtractor,
			_dumpParams
		);
	}

	/** Performs a PATCH request (new options API). @see post */
	async patch<T = unknown>(path: string, options: DataOptions): Promise<T>;
	/** Performs a PATCH request (legacy API). @see post */
	async patch<T = unknown>(
		path: string,
		data?: RequestData,
		params?: FetchParams,
		respHeaders?: ResponseHeaders | null,
		errorMessageExtractor?: ErrorMessageExtractor | null,
		_dumpParams?: boolean
	): Promise<T>;
	async patch(
		path: string,
		dataOrOptions?: RequestData | DataOptions,
		params?: FetchParams,
		respHeaders?: ResponseHeaders | null,
		errorMessageExtractor?: ErrorMessageExtractor | null,
		_dumpParams = false
	): Promise<unknown> {
		let data: RequestData = null;
		let fetchParams: FetchParams | undefined;
		let headers: ResponseHeaders | null = null;
		let extractor: ErrorMessageExtractor | null | undefined = null;

		if (
			dataOrOptions &&
			typeof dataOrOptions === 'object' &&
			!(dataOrOptions instanceof FormData) &&
			('data' in dataOrOptions ||
				'params' in dataOrOptions ||
				'respHeaders' in dataOrOptions ||
				'errorExtractor' in dataOrOptions)
		) {
			const opts = dataOrOptions as DataOptions;
			data = opts.data ?? null;
			fetchParams = opts.params;
			headers = opts.respHeaders ?? null;
			extractor = opts.errorExtractor ?? null;
		} else {
			data = (dataOrOptions as RequestData) ?? null;
			fetchParams = params;
			headers = respHeaders ?? null;
			extractor = errorMessageExtractor ?? null;
		}

		path = this.#buildPath(path, this.#base);
		return _fetch(
			this.#merge(await this.#getDefs(), { ...(fetchParams || {}), data, method: 'PATCH', path }),
			headers,
			extractor ?? this.#factoryErrorMessageExtractor,
			_dumpParams
		);
	}

	/**
	 * Performs a DELETE request (new options API).
	 * Note: Request body in DELETE is allowed per HTTP spec.
	 * @see post
	 */
	async del<T = unknown>(path: string, options: DataOptions): Promise<T>;
	/** Performs a DELETE request (legacy API). @see post */
	async del<T = unknown>(
		path: string,
		data?: RequestData,
		params?: FetchParams,
		respHeaders?: ResponseHeaders | null,
		errorMessageExtractor?: ErrorMessageExtractor | null,
		_dumpParams?: boolean
	): Promise<T>;
	async del(
		path: string,
		dataOrOptions?: RequestData | DataOptions,
		params?: FetchParams,
		respHeaders?: ResponseHeaders | null,
		errorMessageExtractor?: ErrorMessageExtractor | null,
		_dumpParams = false
	): Promise<unknown> {
		let data: RequestData = null;
		let fetchParams: FetchParams | undefined;
		let headers: ResponseHeaders | null = null;
		let extractor: ErrorMessageExtractor | null | undefined = null;

		if (
			dataOrOptions &&
			typeof dataOrOptions === 'object' &&
			!(dataOrOptions instanceof FormData) &&
			('data' in dataOrOptions ||
				'params' in dataOrOptions ||
				'respHeaders' in dataOrOptions ||
				'errorExtractor' in dataOrOptions)
		) {
			const opts = dataOrOptions as DataOptions;
			data = opts.data ?? null;
			fetchParams = opts.params;
			headers = opts.respHeaders ?? null;
			extractor = opts.errorExtractor ?? null;
		} else {
			data = (dataOrOptions as RequestData) ?? null;
			fetchParams = params;
			headers = respHeaders ?? null;
			extractor = errorMessageExtractor ?? null;
		}

		path = this.#buildPath(path, this.#base);
		return _fetch(
			this.#merge(await this.#getDefs(), { ...(fetchParams || {}), data, method: 'DELETE', path }),
			headers,
			extractor ?? this.#factoryErrorMessageExtractor,
			_dumpParams
		);
	}

	/**
	 * Helper method to build the full URL from a path.
	 *
	 * @param path - The path to resolve (absolute URLs are returned as-is).
	 * @returns The resolved URL (base + path, or just path if it's already absolute).
	 */
	url(path: string): string {
		return this.#buildPath(path, this.#base);
	}

	/**
	 * Get or set the base URL for all requests.
	 */
	get base(): string | null | undefined {
		return this.#base;
	}

	set base(v: string | null | undefined) {
		this.#base = v;
	}
}

/**
 * Creates an HTTP API client with convenient defaults and error handling.
 *
 * @param base - Optional base URL to prepend to all requests. Can be changed later via the `base` property.
 * @param defaults - Optional default parameters to merge with each request. Can be an object or async function returning an object.
 * @param factoryErrorMessageExtractor - Optional function to extract error messages from failed responses.
 *
 * @returns An HttpApi instance with methods: get, post, put, patch, del, url, base.
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
export function createHttpApi(
	base?: string | null,
	defaults?: Partial<BaseFetchParams> | (() => Promise<Partial<BaseFetchParams>>),
	factoryErrorMessageExtractor?: ErrorMessageExtractor | null | undefined
): HttpApi {
	return new HttpApi(base, defaults, factoryErrorMessageExtractor);
}

/**
 * Global default error message extractor.
 * Applied to all requests unless overridden at instance or request level.
 * Priority: per-request → per-instance → global → built-in fallback.
 *
 * @example
 * ```ts
 * createHttpApi.defaultErrorMessageExtractor = (body, response) => {
 *   return body?.error?.message || response.statusText;
 * };
 * ```
 */
createHttpApi.defaultErrorMessageExtractor = null as
	| ErrorMessageExtractor
	| null
	| undefined;
