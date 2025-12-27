import { assert, assertEquals } from "@std/assert";
import { createHttpApi, HTTP_ERROR } from "../src/mod.ts";
import { getAvailablePort, hostname } from "./_helpers.ts";

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
		const respHeaders: any = {};

		const r: any = await api.get(`${url}/echo`, {}, respHeaders);
		assertEquals(r.foo, "bar");
		assertEquals(respHeaders.__http_status_code__, 200);
	} finally {
		await server.shutdown();
	}
});

Deno.test("createHttpApi base option", async () => {
	const api = createHttpApi(url);
	const respHeaders: any = {};

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
		assertEquals((e as any).body.error.message, CUSTOM_ERR_MSG);
		assertEquals((e as any).cause.response.headers.hey, "ho");
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
	const respHeaders: any = {};

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
			(body: any, _resp: Response) => {
				return body.error.message.toUpperCase();
			}
		);
		assert(false); // must not be reached
	} catch (e) {
		assert(e instanceof HTTP_ERROR.NotFound);
		assertEquals((e as any).message, CUSTOM_ERR_MSG.toUpperCase());
		assertEquals((e as any).body.error.message, CUSTOM_ERR_MSG);
		assertEquals((e as any).cause.response.headers.hey, "ho");
	}
});

Deno.test("custom factory error message extractor", async () => {
	const api = createHttpApi(
		undefined,
		undefined,
		(body: any, _resp: Response) => {
			return body.error.message.toUpperCase();
		}
	);

	try {
		await api.get(`${url}/asdf`);
		assert(false); // must not be reached
	} catch (e) {
		assert(e instanceof HTTP_ERROR.NotFound);
		assertEquals((e as any).message, CUSTOM_ERR_MSG.toUpperCase());
		assertEquals((e as any).body.error.message, CUSTOM_ERR_MSG);
		assertEquals((e as any).cause.response.headers.hey, "ho");
	}
});

Deno.test("custom global error message extractor", async () => {
	createHttpApi.defaultErrorMessageExtractor = (body: any, _resp: Response) => {
		return body.error.message.toUpperCase();
	};

	const api = createHttpApi();

	try {
		await api.get(`${url}/asdf`);
		assert(false); // must not be reached
	} catch (e) {
		assert(e instanceof HTTP_ERROR.NotFound);
		assertEquals((e as any).message, CUSTOM_ERR_MSG.toUpperCase());
		assertEquals((e as any).body.error.message, CUSTOM_ERR_MSG);
		assertEquals((e as any).cause.response.headers.hey, "ho");
	}
});

Deno.test("createHttpApi POST", async () => {
	const api = createHttpApi();
	const respHeaders: any = {};

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
		method: "must be ignored" as any,
		path: "must be ignored" as any,
		credentials: "include",
	});

	const params = await api.post(
		"/hoho",
		{ foo: "bar" },
		{ headers: { hey: "ho" } },
		null,
		null,
		true
	);

	assertEquals((params as any).headers.authorization, "Bearer foo");
	assertEquals((params as any).headers.hey, "ho");
	assertEquals((params as any).method, "POST");
	assertEquals((params as any).path, "/hoho");
	assertEquals((params as any).credentials, "include");
	assertEquals((params as any).data.foo, "bar");
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
