import { dset } from 'dset/merge';
import { createHttpError } from './error.js';

// this is all very opinionated and may not be useful for every use case...
// there is no magic added over plain fetch calls, just more convenient api

interface BaseParams {
	method: 'GET' | 'POST' | 'PATCH' | 'DELETE' | 'PUT';
	path: string;
}

interface FetchParams {
	data?: any;
	token?: string | null;
	headers?: null | Record<string, string>;
	signal?: any;
	credentials?: null | 'omit' | 'same-origin' | 'include';
	raw?: null | boolean;
	assert?: null | boolean;
}

type BaseFetchParams = BaseParams & FetchParams; // Exclude<Drinks, Soda> |

type ErrorMessageExtractor = (body: any, response: Response) => any;

const _fetchRaw = async ({
	method,
	path,
	data = null,
	token = null,
	headers = null,
	signal = null,
	credentials,
}: BaseFetchParams) => {
	headers = Object.entries(headers || {}).reduce(
		(m, [k, v]) => ({ ...m, [k.toLowerCase()]: v }),
		{}
	);
	const opts: any = { method, credentials, headers, signal };

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

const _fetch = async (
	params: BaseFetchParams,
	respHeaders = null,
	errorMessageExtractor: ErrorMessageExtractor | null | undefined = null,
	_dumpParams = false
) => {
	if (_dumpParams) return params;

	const r = await _fetchRaw(params);
	if (params.raw) return r;

	//
	const headers: any = [...r.headers.entries()].reduce(
		(m, [k, v]) => ({ ...m, [k]: v }),
		{}
	);

	// quick-n-dirty reference to headers (so it's still accessible over this api wrap)
	if (respHeaders) {
		Object.assign(
			respHeaders,
			{ ...headers },
			// adding status/text under special keys
			{ __http_status_code__: r.status, __http_status_text__: r.statusText }
		);
	}

	let body: any = await r.text();
	// prettier-ignore
	try { body = JSON.parse(body); } catch (e) {}

	params.assert ??= true; // default is true

	if (!r.ok && params.assert) {
		// now we need to extract error message from an unknown response... this is obviously
		// impossible unless we know what to expect, but we'll do some educated tries...
		const extractor =
			errorMessageExtractor ?? // provided arg
			createHttpApi.defaultErrorMessageExtractor ?? // static default
			// educated guess fallback
			function (_body: any, _response: Response) {
				let msg =
					// try opinionated convention first
					_body?.error?.message ||
					_body?.message ||
					_response?.statusText ||
					'Unknown error';

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

export function createHttpApi(
	base?: string | null,
	defaults?: Partial<BaseFetchParams> | (() => Promise<Partial<BaseFetchParams>>),
	factoryErrorMessageExtractor?: ErrorMessageExtractor | null | undefined
) {
	const _merge = (a: any, b: any): any => {
		const wrap = { result: a };
		dset(wrap, 'result', b);
		return wrap.result;
	};

	const _getDefs = async () =>
		new Promise<Partial<BaseFetchParams>>(async (resolve) => {
			if (typeof defaults === 'function') {
				resolve({ ...(await defaults()) });
			} else {
				resolve({ ...(defaults || {}) });
			}
		});

	return {
		// GET
		async get(
			path: string,
			params?: FetchParams,
			respHeaders: any = null,
			errorMessageExtractor: ErrorMessageExtractor | null | undefined = null,
			_dumpParams = false
		) {
			path = `${base || ''}${path || ''}`;
			return _fetch(
				_merge(await _getDefs(), { ...params, method: 'GET', path }),
				respHeaders,
				errorMessageExtractor ?? factoryErrorMessageExtractor,
				_dumpParams
			);
		},

		// POST
		async post(
			path: string,
			data: any = null,
			params?: FetchParams,
			respHeaders: any = null,
			errorMessageExtractor: ErrorMessageExtractor | null | undefined = null,
			_dumpParams = false
		) {
			path = `${base || ''}${path || ''}`;
			return _fetch(
				_merge(await _getDefs(), { ...(params || {}), data, method: 'POST', path }),
				respHeaders,
				errorMessageExtractor ?? factoryErrorMessageExtractor,
				_dumpParams
			);
		},

		// PUT
		async put(
			path: string,
			data: any = null,
			params?: FetchParams,
			respHeaders: any = null,
			errorMessageExtractor: ErrorMessageExtractor | null | undefined = null,
			_dumpParams = false
		) {
			path = `${base || ''}${path || ''}`;
			return _fetch(
				_merge(await _getDefs(), { ...(params || {}), data, method: 'PUT', path }),
				respHeaders,
				errorMessageExtractor ?? factoryErrorMessageExtractor,
				_dumpParams
			);
		},

		// PATCH
		async patch(
			path: string,
			data: any = null,
			params?: FetchParams,
			respHeaders: any = null,
			errorMessageExtractor: ErrorMessageExtractor | null | undefined = null,
			_dumpParams = false
		) {
			path = `${base || ''}${path || ''}`;
			return _fetch(
				_merge(await _getDefs(), { ...(params || {}), data, method: 'PATCH', path }),
				respHeaders,
				errorMessageExtractor ?? factoryErrorMessageExtractor,
				_dumpParams
			);
		},

		// DELETE
		// https://stackoverflow.com/questions/299628/is-an-entity-body-allowed-for-an-http-delete-request
		async del(
			path: string,
			data: any = null,
			params?: FetchParams,
			respHeaders: any = null,
			errorMessageExtractor: ErrorMessageExtractor | null | undefined = null,
			_dumpParams = false
		) {
			path = `${base || ''}${path || ''}`;
			return _fetch(
				_merge(await _getDefs(), { ...(params || {}), data, method: 'DELETE', path }),
				respHeaders,
				errorMessageExtractor ?? factoryErrorMessageExtractor,
				_dumpParams
			);
		},
	};
}

createHttpApi.defaultErrorMessageExtractor = null as
	| ErrorMessageExtractor
	| null
	| undefined;
