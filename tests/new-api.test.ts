import { assert, assertEquals } from "@std/assert";
import { createHttpApi, opts } from "../src/mod.ts";
import { getAvailablePort, hostname } from "./_helpers.ts";

// Test server setup
async function createTestServer(port: number): Promise<Deno.HttpServer> {
	const handler = async (req: Request): Promise<Response> => {
		const url = new URL(req.url);
		const headers = new Headers({
			"Content-Type": "application/json",
			"x-custom": req.headers.get("x-custom") || "",
		});

		if (url.pathname === "/echo") {
			if (req.method === "POST") {
				const body = await req.text();
				return new Response(body, { status: 200, headers });
			} else {
				return new Response('{"message":"GET response"}', {
					status: 200,
					headers,
				});
			}
		} else {
			return new Response('{"error":"Not Found"}', {
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

Deno.test("new API: GET with options object", async () => {
	const api = createHttpApi(url);
	const respHeaders: Record<string, string | number> = {};

	// New API style - requires opts() wrapper
	const data = (await api.get(
		"/echo",
		opts({
			params: { headers: { "x-custom": "test-value" } },
			respHeaders,
		}),
	)) as Record<string, unknown>;

	assertEquals(data.message, "GET response");
	assertEquals(respHeaders.__http_status_code__, 200);
	assertEquals(respHeaders["x-custom"], "test-value");
});

Deno.test("new API: POST with options object", async () => {
	const api = createHttpApi(url);
	const respHeaders: Record<string, string | number> = {};

	// New API style - requires opts() wrapper
	const data = (await api.post(
		"/echo",
		opts({
			data: { name: "John", age: 30 },
			params: { headers: { "x-custom": "post-test" } },
			respHeaders,
		}),
	)) as Record<string, unknown>;

	assertEquals(data.name, "John");
	assertEquals(data.age, 30);
	assertEquals(respHeaders.__http_status_code__, 200);
	assertEquals(respHeaders["x-custom"], "post-test");
});

Deno.test("new API: GET with minimal options", async () => {
	const api = createHttpApi(url);

	// Just params, no respHeaders - requires opts() wrapper
	const data = (await api.get(
		"/echo",
		opts({
			params: { raw: false },
		}),
	)) as Record<string, unknown>;

	assertEquals(data.message, "GET response");
});

Deno.test("new API: POST without data field (should work)", async () => {
	const api = createHttpApi(url);

	// Options object without data field (data will be null) - requires opts() wrapper
	const data = await api.post(
		"/echo",
		opts({
			params: { headers: { "x-custom": "no-data" } },
		}),
	);

	// Server echoes empty body (JSON.stringify(null) = "null", but empty body might be "")
	// Just verify it doesn't crash
	assert(data === null || data === "");
});

Deno.test("backward compatibility: legacy GET API still works", async () => {
	const api = createHttpApi(url);
	const respHeaders: Record<string, string | number> = {};

	// Old API style (positional arguments)
	const data = (await api.get(
		"/echo",
		{ headers: { "x-custom": "legacy" } },
		respHeaders,
	)) as Record<string, unknown>;

	assertEquals(data.message, "GET response");
	assertEquals(respHeaders.__http_status_code__, 200);
	assertEquals(respHeaders["x-custom"], "legacy");
});

Deno.test("backward compatibility: legacy POST API still works", async () => {
	const api = createHttpApi(url);
	const respHeaders: Record<string, string | number> = {};

	// Old API style (positional arguments)
	const data = (await api.post(
		"/echo",
		{ name: "Jane" },
		{ headers: { "x-custom": "legacy-post" } },
		respHeaders,
	)) as Record<string, unknown>;

	assertEquals(data.name, "Jane");
	assertEquals(respHeaders.__http_status_code__, 200);
	assertEquals(respHeaders["x-custom"], "legacy-post");
});
