import { assert, assertEquals } from "@std/assert";
import { createHttpApi, HTTP_ERROR } from "../src/mod.ts";
import { getAvailablePort, hostname } from "./_helpers.ts";

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

async function createTestServer(port: number): Promise<Deno.HttpServer> {
	const handler = async (req: Request): Promise<Response> => {
		const url = new URL(req.url);
		const headers = new Headers({
			"Content-Type": "application/json",
			hey: "ho",
			x: req.headers.get("x") || "",
		});

		if (url.pathname === "/echo") {
			if (req.method === "POST") {
				const body = await req.text();
				return new Response(body, { status: 200, headers });
			} else {
				return new Response('{"foo":"bar"}', { status: 200, headers });
			}
		} else {
			return new Response(`{"error":{"message":"${CUSTOM_ERR_MSG}"}}`, {
				status: 404,
				headers,
			});
		}
	};

	return Deno.serve({ hostname, port, onListen: () => {} }, handler);
}

let url: string;
let server: Deno.HttpServer;

Deno.test.beforeEach(async () => {
	const port = await getAvailablePort();
	url = `http://${hostname}:${port}`;
	server = await createTestServer(port);
});

Deno.test.afterEach(async () => {
	await server.shutdown();
});

// Tests with isolated server instances
Deno.test("createHttpApi GET", async () => {
	const port = await getAvailablePort();
	const url = `http://${hostname}:${port}`;
	const server = await createTestServer(port);

	try {
		const api = createHttpApi();
		const respHeaders: Record<string, string | number> = {};

		const r = (await api.get(`${url}/echo`, {}, respHeaders)) as Record<
			string,
			unknown
		>;
		assertEquals(r.foo, "bar");
		assertEquals(respHeaders.__http_status_code__, 200);
	} finally {
		await server.shutdown();
	}
});

Deno.test("createHttpApi base option", async () => {
	const api = createHttpApi(url);
	const respHeaders: Record<string, string | number> = {};

	const r = (await api.get("/echo", {}, respHeaders)) as Record<
		string,
		unknown
	>;
	assertEquals(r.foo, "bar");
	assertEquals(respHeaders.__http_status_code__, 200);
	assertEquals(api.base, url);
});

Deno.test("createHttpApi RAW", async () => {
	const api = createHttpApi();

	// raw
	const r = await api.get(`${url}/echo`, { raw: true });
	assert(r instanceof Response);
	await r.text(); // consume response body to prevent leak

	// off-topic
	assertEquals(api.base, undefined);
	assertEquals(api.url("/foo"), "/foo");
	api.base = url;
	assertEquals(api.base, url);
	assertEquals(api.url("/foo"), url + "/foo");
});

Deno.test("createHttpApi error", async () => {
	const api = createHttpApi();

	try {
		await api.get(`${url}/asdf`);
		assert(false); // must not be reached
	} catch (e) {
		assert(e instanceof HTTP_ERROR.NotFound);
		assertEquals((e.body as ErrorBody).error.message, CUSTOM_ERR_MSG);
		assertEquals((e.cause as ErrorCause).response.headers.hey, "ho");
	}
});

Deno.test("createHttpApi error { raw: true }", async () => {
	const api = createHttpApi();

	const r = await api.get(`${url}/asdf`, { raw: true });
	assert(r instanceof Response);
	assert(!r.ok);
	await r.text(); // consume response body to prevent leak
});

Deno.test("createHttpApi error { assert: false } does not throw", async () => {
	const api = createHttpApi();
	const respHeaders: Record<string, string | number> = {};

	const r = (await api.get(
		`${url}/asdf`,
		{ assert: false },
		respHeaders
	)) as Record<string, unknown>;
	assertEquals((r.error as Record<string, unknown>).message, CUSTOM_ERR_MSG);
	assertEquals(respHeaders.__http_status_code__, 404);
});

Deno.test("custom local error message extractor", async () => {
	const api = createHttpApi();

	try {
		await api.get(
			`${url}/asdf`,
			undefined,
			undefined,
			(body: unknown, _resp: Response) => {
				return (
					body as Record<string, Record<string, string>>
				).error.message.toUpperCase();
			}
		);
		assert(false); // must not be reached
	} catch (e) {
		assert(e instanceof HTTP_ERROR.NotFound);
		assertEquals(e.message, CUSTOM_ERR_MSG.toUpperCase());
		assertEquals((e.body as ErrorBody).error.message, CUSTOM_ERR_MSG);
		assertEquals((e.cause as ErrorCause).response.headers.hey, "ho");
	}
});

Deno.test("custom factory error message extractor", async () => {
	const api = createHttpApi(
		undefined,
		undefined,
		(body: unknown, _resp: Response) => {
			return (
				body as Record<string, Record<string, string>>
			).error.message.toUpperCase();
		}
	);

	try {
		await api.get(`${url}/asdf`);
		assert(false); // must not be reached
	} catch (e) {
		assert(e instanceof HTTP_ERROR.NotFound);
		assertEquals(e.message, CUSTOM_ERR_MSG.toUpperCase());
		assertEquals((e.body as ErrorBody).error.message, CUSTOM_ERR_MSG);
		assertEquals((e.cause as ErrorCause).response.headers.hey, "ho");
	}
});

Deno.test("custom global error message extractor", async () => {
	createHttpApi.defaultErrorMessageExtractor = (
		body: unknown,
		_resp: Response
	) => {
		return (
			body as Record<string, Record<string, string>>
		).error.message.toUpperCase();
	};

	const api = createHttpApi();

	try {
		await api.get(`${url}/asdf`);
		assert(false); // must not be reached
	} catch (e) {
		assert(e instanceof HTTP_ERROR.NotFound);
		assertEquals(e.message, CUSTOM_ERR_MSG.toUpperCase());
		assertEquals((e.body as ErrorBody).error.message, CUSTOM_ERR_MSG);
		assertEquals((e.cause as ErrorCause).response.headers.hey, "ho");
	}
});

Deno.test("createHttpApi POST", async () => {
	const api = createHttpApi();
	const respHeaders: Record<string, string | number> = {};

	const r = (await api.post(
		`${url}/echo`,
		{ hey: "ho" },
		{ headers: { x: "yo" } },
		respHeaders
	)) as Record<string, unknown>;
	assertEquals(r.hey, "ho");
	assertEquals(respHeaders.__http_status_code__, 200);
	assertEquals(respHeaders.x, "yo");
});

Deno.test("createHttpApi merge default params", async () => {
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
		true
	)) as DumpedParams;

	assertEquals(params.headers.authorization, "Bearer foo");
	assertEquals(params.headers.hey, "ho");
	assertEquals(params.method, "POST");
	assertEquals(params.path, "/hoho");
	assertEquals(params.credentials, "include");
	assertEquals(params.data.foo, "bar");
});

Deno.test("url build", () => {
	assertEquals(createHttpApi().url("/foo"), "/foo");
	assertEquals(
		createHttpApi("http://example").url("/foo"),
		"http://example/foo"
	);
	assertEquals(
		createHttpApi("http://ignored").url("http://another/foo"),
		"http://another/foo"
	);
});
