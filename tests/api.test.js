import { createClogStr } from '@marianmeres/clog';
import { TestRunner } from '@marianmeres/test-runner';
import { strict as assert } from 'node:assert';
import { createServer } from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHttpApi, HTTP_ERROR } from '../dist/index.cjs';

const clog = createClogStr(path.basename(fileURLToPath(import.meta.url)));

let server;
const hostname = '127.0.0.1';
const port = 3456;
const url = `http://${hostname}:${port}`;
const CUSTOM_ERR_MSG = 'this is custom error';

// https://nodejs.org/en/learn/modules/anatomy-of-an-http-transaction
const collectBody = async (request) =>
	new Promise((resolve) => {
		let body = [];
		request
			.on('data', (chunk) => body.push(chunk))
			.on('end', () => resolve(Buffer.concat(body).toString()));
	});

const suite = new TestRunner(path.basename(fileURLToPath(import.meta.url)), {
	beforeEach: async () => {
		createHttpApi.defaultErrorMessageExtractor = null;
		server = createServer(async (req, res) => {
			res.setHeader('Content-Type', 'application/json');
			res.setHeader('hey', 'ho');
			res.setHeader('x', req.headers?.x || '');
			if (req.url === '/echo') {
				res.statusCode = 200;
				if (req.method === 'POST') {
					res.end(await collectBody(req));
				} else {
					res.end('{"foo":"bar"}');
				}
			} else {
				res.statusCode = 404;
				res.end(`{"error":{"message":"${CUSTOM_ERR_MSG}"}}`);
			}
		});
		return new Promise((resolve) => server.listen(port, hostname, resolve));
	},
	afterEach: async () => {
		createHttpApi.defaultErrorMessageExtractor = null;
		return new Promise((resolve) => server.close(resolve));
	},
});

suite.test('createHttpApi GET', async () => {
	let api = createHttpApi();
	let respHeaders = {};

	let r = await api.get(`${url}/echo`, {}, respHeaders);
	assert(r.foo === 'bar');
	assert(respHeaders.__http_status_code__ === 200);
});

suite.test('createHttpApi base option', async () => {
	let api = createHttpApi(url);
	let respHeaders = {};

	let r = await api.get(`/echo`, {}, respHeaders);
	assert(r.foo === 'bar');
	assert(respHeaders.__http_status_code__ === 200);
});

suite.test('createHttpApi RAW', async () => {
	let api = createHttpApi();
	let headers = {};

	// raw
	let r = await api.get(`${url}/echo`, { raw: true });
	assert(r instanceof Response);
});

suite.test('createHttpApi error', async () => {
	let api = createHttpApi();

	try {
		let r = await api.get(`${url}/asdf`);
		assert(false); // must not be reached
	} catch (e) {
		assert(e instanceof HTTP_ERROR.NotFound);
		assert(e.body.error.message === CUSTOM_ERR_MSG);
		assert(e.cause.response.headers.hey === 'ho');
	}
});

suite.test('createHttpApi error { raw: true }', async () => {
	let api = createHttpApi();

	let r = await api.get(`${url}/asdf`, { raw: true });
	assert(r instanceof Response);
	assert(!r.ok);
});

suite.test('createHttpApi error { assert: false } does not throw', async () => {
	let api = createHttpApi();
	let respHeaders = {};

	let r = await api.get(`${url}/asdf`, { assert: false }, respHeaders);
	assert(r.error.message === CUSTOM_ERR_MSG);
	assert(respHeaders.__http_status_code__ === 404);
});

suite.test('custom local error message extractor', async () => {
	let api = createHttpApi();

	let err;
	try {
		let r = await api.get(`${url}/asdf`, null, null, (body, resp) => {
			return body.error.message.toUpperCase();
		});
		assert(false); // must not be reached
	} catch (e) {
		assert(e instanceof HTTP_ERROR.NotFound);
		assert(e.message === CUSTOM_ERR_MSG.toUpperCase());
		assert(e.body.error.message === CUSTOM_ERR_MSG);
		assert(e.cause.response.headers.hey === 'ho');
	}
});

suite.test('custom factory error message extractor', async () => {
	let api = createHttpApi(null, null, (body, resp) => {
		return body.error.message.toUpperCase();
	});

	try {
		let r = await api.get(`${url}/asdf`);
		assert(false); // must not be reached
	} catch (e) {
		assert(e instanceof HTTP_ERROR.NotFound);
		assert(e.message === CUSTOM_ERR_MSG.toUpperCase());
		assert(e.body.error.message === CUSTOM_ERR_MSG);
		assert(e.cause.response.headers.hey === 'ho');
	}
});

suite.test('custom global error message extractor', async () => {
	createHttpApi.defaultErrorMessageExtractor = (body, resp) => {
		return body.error.message.toUpperCase();
	};

	let api = createHttpApi();

	try {
		let r = await api.get(`${url}/asdf`);
		assert(false); // must not be reached
	} catch (e) {
		assert(e instanceof HTTP_ERROR.NotFound);
		assert(e.message === CUSTOM_ERR_MSG.toUpperCase());
		assert(e.body.error.message === CUSTOM_ERR_MSG);
		assert(e.cause.response.headers.hey === 'ho');
	}
});

suite.test('createHttpApi POST', async () => {
	let api = createHttpApi();
	let respHeaders = {};

	let r = await api.post(
		`${url}/echo`,
		{ hey: 'ho' },
		{ headers: { x: 'yo' } },
		respHeaders
	);
	assert(r.hey === 'ho');
	assert(respHeaders.__http_status_code__ === 200);
	assert(respHeaders.x === 'yo');
});

suite.test('createHttpApi merge default params', async () => {
	let api = createHttpApi(null, {
		headers: { authorization: 'Bearer foo' },
		method: 'must be ignored',
		path: 'must be ignored',
		credentials: 'include',
	});

	const params = await api.post(
		'/hoho',
		{ foo: 'bar' },
		{ headers: { hey: 'ho' } },
		null,
		null,
		true
	);
	// console.log(params);

	assert(params.headers.authorization === 'Bearer foo');
	assert(params.headers.hey === 'ho');
	assert(params.method === 'POST');
	assert(params.path === '/hoho');
	assert(params.credentials === 'include');
	assert(params.data.foo === 'bar');
});

export default suite;
