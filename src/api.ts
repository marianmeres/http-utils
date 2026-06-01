/**
 * @module api
 *
 * HTTP API client factory and related types.
 * Provides a convenient wrapper over the native `fetch` API with sensible defaults.
 */

import { createHttpError, getErrorMessage, NetworkError } from "./error.ts";

/**
 * Request body data type.
 *
 * Plain objects and arrays are JSON-serialized (with `Content-Type: application/json`
 * when not set). Strings are sent as-is (the caller controls `Content-Type`).
 * Native `BodyInit` types (`FormData`, `Blob`, `ArrayBuffer`, typed arrays,
 * `URLSearchParams`, `ReadableStream`) are passed through unchanged so that
 * `fetch` can handle content-type negotiation (e.g. multipart boundary for
 * FormData, `application/x-www-form-urlencoded` for URLSearchParams).
 */
export type RequestData =
	| Record<string, unknown>
	| unknown[]
	| FormData
	| Blob
	| ArrayBuffer
	| ArrayBufferView
	| URLSearchParams
	| ReadableStream
	| string
	| number
	| boolean
	| null;

/** A primitive that can be serialized into a query-string value. */
type QueryPrimitive = string | number | boolean;

/** A value for {@link FetchParams.query}. `null`/`undefined` entries are skipped. */
export type QueryValue = QueryPrimitive | QueryPrimitive[] | null | undefined;

/**
 * Deep merges two objects. Later properties overwrite earlier properties.
 * Arrays are overwritten, not concatenated (conventional behavior).
 */
function deepMerge<T = unknown>(
	target: Record<string, unknown>,
	source: Record<string, unknown>,
): T {
	const output = { ...target };

	if (isObject(target) && isObject(source)) {
		Object.keys(source).forEach((key) => {
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
	return item !== null && typeof item === "object" && !Array.isArray(item);
}

/**
 * Returns true for body types that native `fetch` knows how to serialize
 * (including setting Content-Type where appropriate). These are passed through
 * unchanged rather than JSON-stringified.
 */
function isNativeBodyInit(v: unknown): boolean {
	if (v instanceof FormData) return true;
	if (typeof Blob !== "undefined" && v instanceof Blob) return true;
	if (v instanceof ArrayBuffer) return true;
	if (ArrayBuffer.isView(v)) return true;
	if (v instanceof URLSearchParams) return true;
	if (typeof ReadableStream !== "undefined" && v instanceof ReadableStream) {
		return true;
	}
	return false;
}

/**
 * Appends query parameters to a URL path. Null/undefined values are skipped.
 * Array values are emitted as repeated keys (e.g. `?tag=a&tag=b`).
 */
function appendQuery(path: string, query: Record<string, QueryValue>): string {
	const sp = new URLSearchParams();
	for (const [k, v] of Object.entries(query)) {
		if (v === null || v === undefined) continue;
		if (Array.isArray(v)) {
			for (const item of v) {
				if (item !== null && item !== undefined) sp.append(k, String(item));
			}
		} else {
			sp.append(k, String(v));
		}
	}
	const qs = sp.toString();
	if (!qs) return path;
	return path + (path.includes("?") ? "&" : "?") + qs;
}

/**
 * Combines a user-provided AbortSignal with an optional timeout-based signal.
 * Returns `undefined` if neither is present.
 */
function composeSignal(
	userSignal: AbortSignal | undefined,
	timeoutMs: number | undefined,
): AbortSignal | undefined {
	if (!timeoutMs || timeoutMs <= 0) return userSignal;
	const timeoutSignal = AbortSignal.timeout(timeoutMs);
	if (!userSignal) return timeoutSignal;
	// AbortSignal.any is available in Node 20+ and modern Deno.
	if (typeof AbortSignal.any === "function") {
		return AbortSignal.any([userSignal, timeoutSignal]);
	}
	// Fallback: manual composition.
	const ctrl = new AbortController();
	const abort = (reason: unknown) => ctrl.abort(reason);
	if (userSignal.aborted) abort(userSignal.reason);
	else userSignal.addEventListener("abort", () => abort(userSignal.reason));
	if (timeoutSignal.aborted) abort(timeoutSignal.reason);
	else {
		timeoutSignal.addEventListener("abort", () => abort(timeoutSignal.reason));
	}
	return ctrl.signal;
}

interface BaseParams {
	method: "GET" | "POST" | "PATCH" | "DELETE" | "PUT";
	path: string;
}

/**
 * Request interceptor. Called after defaults are merged, with the final
 * `RequestInit` and the resolved URL. May return an updated `RequestInit`
 * (or a promise of one). Returning `undefined` keeps the original `init`.
 */
export type RequestInterceptor = (
	init: RequestInit,
	context: { method: string; url: string },
) => RequestInit | void | Promise<RequestInit | void>;

/**
 * Response interceptor. Called before the response body is consumed.
 * May return a replacement `Response` (e.g. retry result); returning
 * `undefined` keeps the original. Must not consume the response body.
 */
export type ResponseInterceptor = (
	response: Response,
	context: { method: string; url: string },
) => Response | void | Promise<Response | void>;

/**
 * Parameters for fetch requests.
 */
export interface FetchParams {
	/** Request body. Plain objects/arrays are JSON-serialized; strings and native BodyInit types are passed through. */
	data?: RequestData;
	/** Bearer token (auto-adds `Authorization: Bearer {token}` header). */
	token?: string | null;
	/** Custom request headers. */
	headers?: HeadersInit | null;
	/** AbortSignal for request cancellation. Combined with `timeout` if both are set. */
	signal?: AbortSignal;
	/** Abort the request after this many milliseconds. Combined with `signal`. */
	timeout?: number | null;
	/** Query parameters appended to the URL. Null/undefined values skipped; arrays become repeated keys. */
	query?: Record<string, QueryValue> | null;
	/** Credentials mode for the request. */
	credentials?: "omit" | "same-origin" | "include" | null;
	/** If true, returns the raw Response object instead of parsed body. Caller must consume the body. */
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
export type ErrorMessageExtractor = (
	body: unknown,
	response: Response,
) => string;

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
	/** Fetch parameters (headers, token, signal, credentials, raw, assert, timeout, query). */
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
	/** Fetch parameters (headers, token, signal, credentials, raw, assert, timeout, query). */
	params?: FetchParams;
	/** Object to receive response headers (will be mutated). */
	respHeaders?: ResponseHeaders | null;
	/** Custom error message extractor for this request. */
	errorExtractor?: ErrorMessageExtractor | null;
}

/** Symbol marker for explicit options API detection. */
const OPTIONS_MARKER = Symbol("options");

/**
 * Marks an options object for the new options API.
 * Use this to explicitly indicate you're using the options-based API.
 *
 * @example
 * ```ts
 * // GET with options
 * await api.get('/users', opts({ params: { token: 'abc' } }));
 *
 * // POST with options
 * await api.post('/users', opts({ data: { name: 'John' }, params: { token: 'abc' } }));
 * ```
 */
export function opts<T extends GetOptions | DataOptions>(options: T): T {
	return Object.assign(options, { [OPTIONS_MARKER]: true });
}

// Internal parsed options types
interface ParsedGetOptions {
	params: FetchParams | undefined;
	respHeaders: ResponseHeaders | null;
	errorExtractor: ErrorMessageExtractor | null | undefined;
}

interface ParsedDataOptions {
	data: RequestData;
	params: FetchParams | undefined;
	respHeaders: ResponseHeaders | null;
	errorExtractor: ErrorMessageExtractor | null | undefined;
}

/**
 * Parses GET method arguments, detecting new options API via OPTIONS_MARKER.
 */
function parseGetOptions(
	paramsOrOptions: FetchParams | GetOptions | undefined,
	legacyRespHeaders?: ResponseHeaders | null,
	legacyErrorExtractor?: ErrorMessageExtractor | null,
): ParsedGetOptions {
	if (paramsOrOptions && OPTIONS_MARKER in paramsOrOptions) {
		const o = paramsOrOptions as GetOptions;
		return {
			params: o.params,
			respHeaders: o.respHeaders ?? null,
			errorExtractor: o.errorExtractor ?? null,
		};
	}
	return {
		params: paramsOrOptions as FetchParams | undefined,
		respHeaders: legacyRespHeaders ?? null,
		errorExtractor: legacyErrorExtractor ?? null,
	};
}

/**
 * Parses body method arguments (POST/PUT/PATCH/DELETE), detecting new options API via OPTIONS_MARKER.
 */
function parseDataOptions(
	dataOrOptions: RequestData | DataOptions | undefined,
	legacyParams?: FetchParams,
	legacyRespHeaders?: ResponseHeaders | null,
	legacyErrorExtractor?: ErrorMessageExtractor | null,
): ParsedDataOptions {
	if (
		dataOrOptions &&
		typeof dataOrOptions === "object" &&
		OPTIONS_MARKER in (dataOrOptions as object)
	) {
		const o = dataOrOptions as DataOptions;
		return {
			data: o.data ?? null,
			params: o.params,
			respHeaders: o.respHeaders ?? null,
			errorExtractor: o.errorExtractor ?? null,
		};
	}
	return {
		data: (dataOrOptions as RequestData) ?? null,
		params: legacyParams,
		respHeaders: legacyRespHeaders ?? null,
		errorExtractor: legacyErrorExtractor ?? null,
	};
}

/**
 * Builds the final RequestInit and serialized URL from FetchParams.
 * Does not call fetch.
 */
function buildRequest(params: BaseFetchParams): {
	url: string;
	init: RequestInit;
} {
	const {
		method,
		path,
		data = null,
		token = null,
		headers = null,
		signal,
		timeout,
		query,
		credentials,
	} = params;

	const normalizedHeaders: Record<string, string> = {};
	if (headers) {
		new Headers(headers).forEach((value, key) => {
			normalizedHeaders[key] = value;
		});
	}

	const init: RequestInit = { method };
	if (credentials) init.credentials = credentials;

	const composedSignal = composeSignal(signal, timeout ?? undefined);
	if (composedSignal) init.signal = composedSignal;

	// Body handling — send in order of most specific to least.
	if (data !== null && data !== undefined) {
		if (isNativeBodyInit(data)) {
			// fetch knows how to serialize these and sets Content-Type as needed.
			init.body = data as BodyInit;
		} else if (typeof data === "string") {
			// Raw strings are sent as-is; caller controls Content-Type.
			init.body = data;
		} else {
			// Plain objects, arrays, numbers, booleans → JSON.
			if (!normalizedHeaders["content-type"]) {
				normalizedHeaders["content-type"] = "application/json";
			}
			init.body = JSON.stringify(data);
		}
	}

	// Opinionated convention: auto-add Bearer token
	if (token) {
		normalizedHeaders["authorization"] = `Bearer ${token}`;
	}

	init.headers = normalizedHeaders;

	let url = path;
	if (query) url = appendQuery(url, query);

	return { url, init };
}

/** Best-effort human-readable description of a `fetch` target for error messages. */
function _describeFetchTarget(input: Parameters<typeof fetch>[0]): string {
	if (typeof input === "string") return input;
	if (input instanceof URL) return input.href;
	return (input as Request)?.url ?? String(input);
}

/**
 * Options for {@link fetchOrThrow}. Pass as the 3rd argument in place of a bare
 * `what` string (a string is normalized to `{ what }`).
 *
 * `onRequest`/`onError` are **pure observers** — their return value is ignored,
 * they cannot recover or transform the request/error. For recovery or retries
 * use the {@link HttpApi} interceptors or your own `catch`.
 */
export interface FetchOrThrowOptions {
	/** Human-readable label for the target (e.g. "Token issuer"), used in error messages. */
	what?: string;
	/**
	 * Called synchronously just before the request is dispatched. No-op by
	 * default. Useful for request tracing — including the hang case where
	 * neither a response nor an error ever arrives. If this throws, the request
	 * is NOT sent (a throwing tracer is a clear consumer bug, and there is no
	 * original error to preserve — unlike {@link FetchOrThrowOptions.onError}).
	 */
	onRequest?: (info: { url: string; method?: string; what?: string }) => void;
	/**
	 * Called just before a transport-level failure is (re-)thrown. Pure observer:
	 * its return value is ignored and the original error always propagates. A
	 * throw here is swallowed so a broken hook can never mask the real error.
	 * `kind` classifies the failure so callers can, e.g., skip deliberate aborts.
	 */
	onError?: (info: {
		error: unknown;
		url: string;
		what?: string;
		kind: "abort" | "timeout" | "network";
		/**
		 * Human-readable failure reason, extracted via `getErrorMessage`. For a
		 * `network` failure this is the resolved transport reason embedded in the
		 * `NetworkError` message (e.g. `"ENOTFOUND"`); for `abort`/`timeout` it is
		 * the message of the original error. Always a string — handy for structured
		 * logging without re-parsing `error` yourself.
		 */
		reason: string;
	}) => void;
}

/**
 * Global defaults for {@link fetchOrThrow}, exposed as `fetchOrThrow.global` and
 * overridable per call (resolution is `per-call ?? global`). Observer hooks only
 * — `what` is per-call by nature, so it is intentionally excluded.
 */
export type FetchOrThrowGlobalOptions = Pick<
	FetchOrThrowOptions,
	"onRequest" | "onError"
>;

// `Symbol.for` + `globalThis` so multiple bundled copies of this package still
// share one config object (same approach as `@marianmeres/clog`'s global state).
const _FOT_GLOBAL_KEY = Symbol.for("@marianmeres/http-utils/fetchOrThrow");
const _FOT_GLOBAL: FetchOrThrowGlobalOptions =
	// deno-lint-ignore no-explicit-any
	((globalThis as any)[_FOT_GLOBAL_KEY] ??= {
		onRequest: undefined,
		onError: undefined,
	});

/**
 * Invoke an `onError` observer defensively: `url` and `reason` are only computed
 * when a hook is present (the network path passes its already-resolved `reason`
 * to avoid a second extraction), and a throwing hook is swallowed so it can never
 * replace the real error that is about to propagate.
 */
function _notifyFetchError(
	hook: FetchOrThrowOptions["onError"],
	error: unknown,
	describe: (input: Parameters<typeof fetch>[0]) => string,
	input: Parameters<typeof fetch>[0],
	what: string | undefined,
	kind: "abort" | "timeout" | "network",
	reason?: string,
): void {
	if (!hook) return;
	try {
		hook({
			error,
			url: describe(input),
			what,
			kind,
			reason: reason ?? getErrorMessage(error),
		});
	} catch {
		/* observer hooks must not alter control flow */
	}
}

/**
 * Wraps the native `fetch` so a transport-level failure surfaces the target host
 * and the real reason instead of an opaque "fetch failed".
 *
 * Node/undici collapses DNS failures, refused connections and connect timeouts
 * into a `TypeError: fetch failed` whose actual code (`ENOTFOUND`,
 * `ECONNREFUSED`, `UND_ERR_CONNECT_TIMEOUT`, ...) lives on `err.cause` and is
 * absent from the message and stack. On such a failure this throws a
 * `NetworkError` (see {@link HTTP_ERROR}) whose message includes the URL and the
 * resolved reason, and whose `cause` is the underlying transport error (so both
 * `error.message` and `getErrorMessage(error)` report the real reason).
 *
 * Deliberate cancellations (`AbortError`) and timeouts (`TimeoutError`) are
 * re-thrown untouched — they already carry clear semantics and must not be
 * masked as "host unreachable".
 *
 * Optional observer hooks (`onRequest`/`onError`, see {@link FetchOrThrowOptions})
 * can trace the request without wrapping the call site in `try/catch`; the most
 * useful case is detecting a hang, where neither a response nor an error ever
 * arrives. Defaults can be set once on `fetchOrThrow.global` and overridden per
 * call (resolution is `per-call ?? global`). Because {@link HttpApi} routes every
 * request through this function, the global hooks instrument it too.
 *
 * @param input - The `fetch` resource (URL string, `URL`, or `Request`).
 * @param init - The `fetch` `RequestInit` options.
 * @param what - Either a label describing the target (e.g. "Token issuer"), used
 *   to prefix the error message, or a {@link FetchOrThrowOptions} object carrying
 *   that label plus the `onRequest`/`onError` observer hooks.
 *
 * @returns The `Response`. This does NOT throw on non-2xx HTTP statuses — only
 *   on transport-level failures, exactly like the native `fetch`.
 *
 * @throws A `NetworkError` on a transport-level failure (DNS, refused
 *   connection, unreachable host, ...).
 *
 * @example
 * ```ts
 * import { fetchOrThrow, HTTP_ERROR } from "@marianmeres/http-utils";
 *
 * // Configure tracing once, app-wide (also instruments the HttpApi client):
 * fetchOrThrow.global.onRequest = ({ method, url }) => console.debug(`→ ${method} ${url}`);
 * fetchOrThrow.global.onError = ({ url, kind, reason }) =>
 *   kind !== "abort" && console.error(`✗ ${url}: ${reason}`);
 *
 * try {
 *   const res = await fetchOrThrow("https://issuer.example.com/jwks", undefined, "Token issuer");
 * } catch (e) {
 *   if (e instanceof HTTP_ERROR.NetworkError) {
 *     // e.message → "Token issuer unreachable (https://issuer.example.com/jwks): ENOTFOUND"
 *     // e.cause   → underlying transport error
 *   }
 * }
 * ```
 */
export async function fetchOrThrow(
	input: Parameters<typeof fetch>[0],
	init?: Parameters<typeof fetch>[1],
	what?: string | FetchOrThrowOptions,
): Promise<Response> {
	const opts: FetchOrThrowOptions = typeof what === "string" ? { what } : (what ?? {});
	const label = opts.what;
	// Per-call wins over the global default (override, not chain).
	const onRequest = opts.onRequest ?? _FOT_GLOBAL.onRequest;
	const onError = opts.onError ?? _FOT_GLOBAL.onError;

	if (onRequest) {
		const method = (init as { method?: string } | undefined)?.method ??
			(input instanceof Request ? input.method : undefined);
		onRequest({ url: _describeFetchTarget(input), method, what: label });
	}

	try {
		return await fetch(input, init);
	} catch (err) {
		const name = (err as Error)?.name;
		const kind: "abort" | "timeout" | "network" = name === "AbortError"
			? "abort"
			: name === "TimeoutError"
			? "timeout"
			: "network";

		// Preserve deliberate cancellations and timeouts as-is.
		if (kind !== "network") {
			_notifyFetchError(onError, err, _describeFetchTarget, input, label, kind);
			throw err;
		}

		// undici/Node bury the real reason on `err.cause`; prefer it so both
		// `.message` and `getErrorMessage(networkError)` surface ENOTFOUND/etc.
		// rather than re-surfacing the opaque outer "fetch failed".
		const underlying = (err as { cause?: unknown })?.cause ?? err;
		const reason = getErrorMessage(underlying);
		const url = _describeFetchTarget(input);
		const message = label
			? `${label} unreachable (${url}): ${reason}`
			: `Network request to ${url} failed: ${reason}`;
		const networkError = new NetworkError(message, { cause: underlying });
		_notifyFetchError(onError, networkError, () => url, input, label, kind, reason);
		throw networkError;
	}
}

/**
 * Global defaults for {@link fetchOrThrow}'s observer hooks, overridable per call.
 * Mirrors `createHttpApi.defaultErrorMessageExtractor` and `createClog.global`.
 *
 * @example
 * ```ts
 * fetchOrThrow.global.onRequest = ({ method, url }) => console.debug(`→ ${method} ${url}`);
 * ```
 */
fetchOrThrow.global = _FOT_GLOBAL;

const _fetch = async (
	params: BaseFetchParams,
	respHeaders: ResponseHeaders | null = null,
	errorMessageExtractor: ErrorMessageExtractor | null | undefined = null,
	requestInterceptor: RequestInterceptor | null | undefined = null,
	responseInterceptor: ResponseInterceptor | null | undefined = null,
	_dumpParams = false,
) => {
	if (_dumpParams) return params;

	let { url, init } = buildRequest(params);

	if (requestInterceptor) {
		const patched = await requestInterceptor(init, {
			method: params.method,
			url,
		});
		if (patched) init = patched;
	}

	let r = await fetchOrThrow(url, init, params.method);

	if (responseInterceptor) {
		const patched = await responseInterceptor(r, {
			method: params.method,
			url,
		});
		if (patched && patched !== r) {
			// Cancel the original body so the underlying stream doesn't leak.
			try {
				await r.body?.cancel();
			} catch (_e) {
				/* ignore */
			}
			r = patched;
		}
	}

	if (params.raw) return r;

	// Convert Headers to plain object
	const headers: ResponseHeaders = [...r.headers.entries()].reduce(
		(m, [k, v]) => ({ ...m, [k]: v }),
		{} as ResponseHeaders,
	);

	// Mutate respHeaders to provide access to response headers and status
	if (respHeaders) {
		Object.assign(
			respHeaders,
			headers,
			// Add status/text under special keys
			{ __http_status_code__: r.status, __http_status_text__: r.statusText },
		);
	}

	const text = await r.text();
	let body: unknown = text;
	if (text === "") {
		// Treat empty body (204/205 and friends) as null rather than "".
		body = null;
	} else {
		// prettier-ignore
		try {
			body = JSON.parse(text);
		} catch (_e) { /* ignore parse errors */ }
	}

	params.assert ??= true; // default is true

	if (!r.ok && params.assert) {
		// Now we need to extract an error message from an unknown response shape.
		// We try, in order: the per-call extractor, the factory/global, and a
		// built-in guess. If a user-provided extractor throws, we must not let
		// it replace the real HTTP error — fall back to statusText.
		const tryExtract = (
			fn: ErrorMessageExtractor | null | undefined,
		): string | null => {
			if (!fn) return null;
			try {
				return fn(body, r);
			} catch (_e) {
				return null;
			}
		};

		const builtIn: ErrorMessageExtractor = (_body, _response) => {
			const b = _body as Record<string, unknown> | null;
			let msg: string = String(
				(b?.error as Record<string, unknown>)?.message ||
					b?.message ||
					b?.error ||
					_response?.statusText ||
					"Unknown error",
			);
			if (msg.length > 255) msg = `[Shortened]: ${msg.slice(0, 255)}`;
			return msg;
		};

		const msg = tryExtract(errorMessageExtractor) ??
			tryExtract(createHttpApi.defaultErrorMessageExtractor) ??
			builtIn(body, r);

		throw createHttpError(r.status, msg, body, {
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
	#defaults?:
		| Partial<BaseFetchParams>
		| (() => Promise<Partial<BaseFetchParams>>);
	#factoryErrorMessageExtractor?: ErrorMessageExtractor | null | undefined;
	#requestInterceptor?: RequestInterceptor | null;
	#responseInterceptor?: ResponseInterceptor | null;

	constructor(
		base?: string | null,
		defaults?:
			| Partial<BaseFetchParams>
			| (() => Promise<Partial<BaseFetchParams>>),
		factoryErrorMessageExtractor?: ErrorMessageExtractor | null | undefined,
	) {
		this.#base = base;
		this.#defaults = defaults;
		this.#factoryErrorMessageExtractor = factoryErrorMessageExtractor;

		// Bind methods for destructuring support
		this.get = this.get.bind(this);
		this.post = this.post.bind(this);
		this.put = this.put.bind(this);
		this.patch = this.patch.bind(this);
		this.del = this.del.bind(this);
		this.url = this.url.bind(this);
	}

	#merge<T = unknown>(
		a: Record<string, unknown>,
		b: Record<string, unknown>,
	): T {
		return deepMerge<T>(a, b);
	}

	async #getDefs(): Promise<Partial<BaseFetchParams>> {
		if (typeof this.#defaults === "function") {
			return { ...(await this.#defaults()) };
		}
		return { ...(this.#defaults || {}) };
	}

	#buildPath(path: string, base?: string | null): string {
		const p = `${path ?? ""}`;
		const b = `${base ?? ""}`;
		if (/^https?:/i.test(p)) return p;
		if (!b) return p;
		const baseNoTrail = b.replace(/\/+$/, "");
		const pathLead = p.startsWith("/") ? p : `/${p}`;
		return baseNoTrail + pathLead;
	}

	/**
	 * Register a request interceptor. Called after defaults are merged.
	 * Returning a new `RequestInit` replaces the original.
	 */
	onRequest(interceptor: RequestInterceptor | null): this {
		this.#requestInterceptor = interceptor;
		return this;
	}

	/**
	 * Register a response interceptor. Called before the body is consumed.
	 * Must not consume the body. Returning a new `Response` replaces the original.
	 */
	onResponse(interceptor: ResponseInterceptor | null): this {
		this.#responseInterceptor = interceptor;
		return this;
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
	 * const data = await api.get('/users', opts({
	 *   params: { headers: { 'X-Custom': 'value' } },
	 *   respHeaders: {}
	 * }));
	 * ```
	 */
	async get<T = unknown>(path: string, options: GetOptions): Promise<T>;

	/**
	 * Performs a GET request (legacy API).
	 */
	async get<T = unknown>(
		path: string,
		params?: FetchParams,
		respHeaders?: ResponseHeaders | null,
		errorMessageExtractor?: ErrorMessageExtractor | null,
		_dumpParams?: boolean,
	): Promise<T>;

	async get(
		path: string,
		paramsOrOptions?: FetchParams | GetOptions,
		respHeaders?: ResponseHeaders | null,
		errorMessageExtractor?: ErrorMessageExtractor | null,
		_dumpParams = false,
	): Promise<unknown> {
		const {
			params,
			respHeaders: headers,
			errorExtractor,
		} = parseGetOptions(paramsOrOptions, respHeaders, errorMessageExtractor);

		path = this.#buildPath(path, this.#base);
		return _fetch(
			this.#merge(await this.#getDefs(), { ...params, method: "GET", path }),
			headers,
			errorExtractor ?? this.#factoryErrorMessageExtractor,
			this.#requestInterceptor,
			this.#responseInterceptor,
			_dumpParams,
		);
	}

	/**
	 * Performs a POST request (new options API - recommended).
	 */
	async post<T = unknown>(path: string, options: DataOptions): Promise<T>;

	/**
	 * Performs a POST request (legacy API).
	 */
	async post<T = unknown>(
		path: string,
		data?: RequestData,
		params?: FetchParams,
		respHeaders?: ResponseHeaders | null,
		errorMessageExtractor?: ErrorMessageExtractor | null,
		_dumpParams?: boolean,
	): Promise<T>;

	async post(
		path: string,
		dataOrOptions?: RequestData | DataOptions,
		params?: FetchParams,
		respHeaders?: ResponseHeaders | null,
		errorMessageExtractor?: ErrorMessageExtractor | null,
		_dumpParams = false,
	): Promise<unknown> {
		return await this.#body(
			"POST",
			path,
			dataOrOptions,
			params,
			respHeaders,
			errorMessageExtractor,
			_dumpParams,
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
		_dumpParams?: boolean,
	): Promise<T>;
	async put(
		path: string,
		dataOrOptions?: RequestData | DataOptions,
		params?: FetchParams,
		respHeaders?: ResponseHeaders | null,
		errorMessageExtractor?: ErrorMessageExtractor | null,
		_dumpParams = false,
	): Promise<unknown> {
		return await this.#body(
			"PUT",
			path,
			dataOrOptions,
			params,
			respHeaders,
			errorMessageExtractor,
			_dumpParams,
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
		_dumpParams?: boolean,
	): Promise<T>;
	async patch(
		path: string,
		dataOrOptions?: RequestData | DataOptions,
		params?: FetchParams,
		respHeaders?: ResponseHeaders | null,
		errorMessageExtractor?: ErrorMessageExtractor | null,
		_dumpParams = false,
	): Promise<unknown> {
		return await this.#body(
			"PATCH",
			path,
			dataOrOptions,
			params,
			respHeaders,
			errorMessageExtractor,
			_dumpParams,
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
		_dumpParams?: boolean,
	): Promise<T>;
	async del(
		path: string,
		dataOrOptions?: RequestData | DataOptions,
		params?: FetchParams,
		respHeaders?: ResponseHeaders | null,
		errorMessageExtractor?: ErrorMessageExtractor | null,
		_dumpParams = false,
	): Promise<unknown> {
		return await this.#body(
			"DELETE",
			path,
			dataOrOptions,
			params,
			respHeaders,
			errorMessageExtractor,
			_dumpParams,
		);
	}

	async #body(
		method: BaseParams["method"],
		path: string,
		dataOrOptions: RequestData | DataOptions | undefined,
		params: FetchParams | undefined,
		respHeaders: ResponseHeaders | null | undefined,
		errorMessageExtractor: ErrorMessageExtractor | null | undefined,
		_dumpParams: boolean,
	): Promise<unknown> {
		const {
			data,
			params: fetchParams,
			respHeaders: headers,
			errorExtractor,
		} = parseDataOptions(
			dataOrOptions,
			params,
			respHeaders,
			errorMessageExtractor,
		);

		path = this.#buildPath(path, this.#base);
		return _fetch(
			this.#merge(await this.#getDefs(), {
				...(fetchParams || {}),
				data,
				method,
				path,
			}),
			headers,
			errorExtractor ?? this.#factoryErrorMessageExtractor,
			this.#requestInterceptor,
			this.#responseInterceptor,
			_dumpParams,
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
	defaults?:
		| Partial<BaseFetchParams>
		| (() => Promise<Partial<BaseFetchParams>>),
	factoryErrorMessageExtractor?: ErrorMessageExtractor | null | undefined,
): HttpApi {
	return new HttpApi(base, defaults, factoryErrorMessageExtractor);
}

/**
 * Global default error message extractor.
 * Applied to all requests unless overridden at instance or request level.
 * Priority: per-request → per-instance → global → built-in fallback.
 *
 * A throwing extractor will not crash the call — the next priority level is
 * used as a fallback.
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
