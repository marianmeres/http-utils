import assert from "node:assert/strict";
import { afterEach, beforeEach, test } from "node:test";
import { createHttpApi, fetchOrThrow, HTTP_ERROR } from "../src/mod.ts";
import { hostname, serve, type TestServer } from "./_helpers.ts";

// Helper types for test assertions
type ErrorBody = { error: { message: string } };
type ErrorCause = { response: { headers: Record<string, string> } };
type DumpedParams = {
	headers: Record<string, string>;
	method: string;
	path: string;
	credentials: string;
	data: Record<string, unknown>;
};

const CUSTOM_ERR_MSG = "this is custom error";

function createTestServer(): Promise<TestServer> {
	const handler = async (req: Request): Promise<Response> => {
		const url = new URL(req.url);
		const headers = new Headers({
			"Content-Type": "application/json",
			hey: "ho",
			x: req.headers.get("x") || "",
		});

		// Append all "x-" from request to response as well (so we can test what was sent)
		[...req.headers.keys()]
			.filter((k) => k.startsWith("x-"))
			.forEach((k) => {
				headers.append(k, req.headers.get(k)!);
			});

		if (url.pathname === "/echo") {
			if (req.method === "POST") {
				const body = await req.text();
				return new Response(body, { status: 200, headers });
			} else {
				const out = { foo: "bar", ...Object.fromEntries(headers.entries()) };
				return new Response(JSON.stringify(out), { status: 200, headers });
			}
		} else {
			return new Response(`{"error":{"message":"${CUSTOM_ERR_MSG}"}}`, {
				status: 404,
				headers,
			});
		}
	};

	return serve({ hostname }, handler);
}

let url: string;
let server: TestServer;

beforeEach(async () => {
	server = await createTestServer();
	url = `http://${hostname}:${server.port}`;
});

afterEach(async () => {
	await server.shutdown();
});

// Tests with isolated server instances
test("createHttpApi GET", async () => {
	const api = createHttpApi();
	const respHeaders: Record<string, string | number> = {};

	const r = (await api.get(`${url}/echo`, {}, respHeaders)) as Record<string, unknown>;
	assert.deepStrictEqual(r.foo, "bar");
	assert.deepStrictEqual(respHeaders.__http_status_code__, 200);
});

test("createHttpApi GET with headers", async () => {
	const api = createHttpApi(url);
	const r = await api.get<Record<string, unknown>>("/echo", {
		headers: { "X-Hey": "Ho" },
	});
	assert.deepStrictEqual(r["x-hey"], "Ho");
});

test("createHttpApi base option", async () => {
	const api = createHttpApi(url);
	const respHeaders: Record<string, string | number> = {};

	const r = (await api.get("/echo", {}, respHeaders)) as Record<string, unknown>;
	assert.deepStrictEqual(r.foo, "bar");
	assert.deepStrictEqual(respHeaders.__http_status_code__, 200);
	assert.deepStrictEqual(api.base, url);
});

test("createHttpApi RAW", async () => {
	const api = createHttpApi();

	// raw
	const r = await api.get(`${url}/echo`, { raw: true });
	assert.ok(r instanceof Response);
	await r.text(); // consume response body to prevent leak

	// off-topic
	assert.deepStrictEqual(api.base, undefined);
	assert.deepStrictEqual(api.url("/foo"), "/foo");
	api.base = url;
	assert.deepStrictEqual(api.base, url);
	assert.deepStrictEqual(api.url("/foo"), url + "/foo");
});

test("createHttpApi error", async () => {
	const api = createHttpApi();

	try {
		await api.get(`${url}/asdf`);
		assert.ok(false); // must not be reached
	} catch (e) {
		assert.ok(e instanceof HTTP_ERROR.NotFound);
		assert.deepStrictEqual((e.body as ErrorBody).error.message, CUSTOM_ERR_MSG);
		assert.deepStrictEqual((e.cause as ErrorCause).response.headers.hey, "ho");
	}
});

test("createHttpApi transport failure surfaces NetworkError", async () => {
	const api = createHttpApi();

	try {
		// reserved TLD (RFC 6761) — guaranteed DNS failure
		await api.get("http://does-not-exist.invalid");
		assert.ok(false); // must not be reached
	} catch (e) {
		assert.ok(e instanceof HTTP_ERROR.NetworkError);
		assert.ok((e as Error).message.includes("does-not-exist.invalid"));
		// the method is used as the label
		assert.ok((e as Error).message.includes("GET unreachable"));
	}
});

test("createHttpApi requests trigger fetchOrThrow.global hooks", async () => {
	// HttpApi routes every request through fetchOrThrow, so a single global
	// default instruments the client too.
	let calls = 0;
	let seenUrl = "";
	let seenMethod: string | undefined;
	fetchOrThrow.global.onRequest = (i) => {
		calls++;
		seenUrl = i.url;
		seenMethod = i.method;
	};
	try {
		const api = createHttpApi();
		await api.get(`${url}/echo`);
		assert.deepStrictEqual(calls, 1);
		assert.ok(seenUrl.includes("/echo"));
		assert.deepStrictEqual(seenMethod, "GET");
	} finally {
		fetchOrThrow.global.onRequest = undefined;
	}
});

test("createHttpApi error { raw: true }", async () => {
	const api = createHttpApi();

	const r = await api.get(`${url}/asdf`, { raw: true });
	assert.ok(r instanceof Response);
	assert.ok(!r.ok);
	await r.text(); // consume response body to prevent leak
});

test("createHttpApi error { assert: false } does not throw", async () => {
	const api = createHttpApi();
	const respHeaders: Record<string, string | number> = {};

	const r = (await api.get(`${url}/asdf`, { assert: false }, respHeaders)) as Record<
		string,
		unknown
	>;
	assert.deepStrictEqual((r.error as Record<string, unknown>).message, CUSTOM_ERR_MSG);
	assert.deepStrictEqual(respHeaders.__http_status_code__, 404);
});

test("custom local error message extractor", async () => {
	const api = createHttpApi();

	try {
		await api.get(
			`${url}/asdf`,
			undefined,
			undefined,
			(body: unknown, _resp: Response) => {
				return (body as ErrorBody).error.message.toUpperCase();
			},
		);
		assert.ok(false); // must not be reached
	} catch (e) {
		assert.ok(e instanceof HTTP_ERROR.NotFound);
		assert.deepStrictEqual(e.message, CUSTOM_ERR_MSG.toUpperCase());
		assert.deepStrictEqual((e.body as ErrorBody).error.message, CUSTOM_ERR_MSG);
		assert.deepStrictEqual((e.cause as ErrorCause).response.headers.hey, "ho");
	}
});

test("custom factory error message extractor", async () => {
	const api = createHttpApi(undefined, undefined, (body: unknown, _resp: Response) => {
		return (body as ErrorBody).error.message.toUpperCase();
	});

	try {
		await api.get(`${url}/asdf`);
		assert.ok(false); // must not be reached
	} catch (e) {
		assert.ok(e instanceof HTTP_ERROR.NotFound);
		assert.deepStrictEqual(e.message, CUSTOM_ERR_MSG.toUpperCase());
		assert.deepStrictEqual((e.body as ErrorBody).error.message, CUSTOM_ERR_MSG);
		assert.deepStrictEqual((e.cause as ErrorCause).response.headers.hey, "ho");
	}
});

test("custom global error message extractor", async () => {
	createHttpApi.defaultErrorMessageExtractor = (body: unknown, _resp: Response) => {
		return (body as ErrorBody).error.message.toUpperCase();
	};

	const api = createHttpApi();

	try {
		await api.get(`${url}/asdf`);
		assert.ok(false); // must not be reached
	} catch (e) {
		assert.ok(e instanceof HTTP_ERROR.NotFound);
		assert.deepStrictEqual(e.message, CUSTOM_ERR_MSG.toUpperCase());
		assert.deepStrictEqual((e.body as ErrorBody).error.message, CUSTOM_ERR_MSG);
		assert.deepStrictEqual((e.cause as ErrorCause).response.headers.hey, "ho");
	}
});

test("createHttpApi POST", async () => {
	const api = createHttpApi();
	const respHeaders: Record<string, string | number> = {};

	const r = (await api.post(
		`${url}/echo`,
		{ hey: "ho" },
		{ headers: { x: "yo" } },
		respHeaders,
	)) as Record<string, unknown>;
	assert.deepStrictEqual(r.hey, "ho");
	assert.deepStrictEqual(respHeaders.__http_status_code__, 200);
	assert.deepStrictEqual(respHeaders.x, "yo");
});

test("createHttpApi merge default params", async () => {
	const api = createHttpApi(null, {
		headers: { authorization: "Bearer foo" },
		// @ts-expect-error testing that invalid props are ignored
		method: "must be ignored",
		path: "must be ignored" as unknown as undefined, // invalid prop, should be ignored
		credentials: "include",
	});

	const params = (await api.post(
		"/hoho",
		{ foo: "bar" },
		{ headers: { hey: "ho" } },
		null,
		null,
		true,
	)) as DumpedParams;

	assert.deepStrictEqual(params.headers.authorization, "Bearer foo");
	assert.deepStrictEqual(params.headers.hey, "ho");
	assert.deepStrictEqual(params.method, "POST");
	assert.deepStrictEqual(params.path, "/hoho");
	assert.deepStrictEqual(params.credentials, "include");
	assert.deepStrictEqual(params.data.foo, "bar");
});

test("url build", () => {
	assert.deepStrictEqual(createHttpApi().url("/foo"), "/foo");
	assert.deepStrictEqual(
		createHttpApi("http://example").url("/foo"),
		"http://example/foo",
	);
	assert.deepStrictEqual(
		createHttpApi("http://ignored").url("http://another/foo"),
		"http://another/foo",
	);
});
