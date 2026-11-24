import assert from "node:assert/strict";
import { afterEach, beforeEach, test } from "node:test";
import { createHttpApi, opts } from "../src/mod.ts";
import { hostname, serve, type TestServer } from "./_helpers.ts";

// Test server setup
function createTestServer(): Promise<TestServer> {
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

test("new API: GET with options object", async () => {
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

	assert.deepStrictEqual(data.message, "GET response");
	assert.deepStrictEqual(respHeaders.__http_status_code__, 200);
	assert.deepStrictEqual(respHeaders["x-custom"], "test-value");
});

test("new API: POST with options object", async () => {
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

	assert.deepStrictEqual(data.name, "John");
	assert.deepStrictEqual(data.age, 30);
	assert.deepStrictEqual(respHeaders.__http_status_code__, 200);
	assert.deepStrictEqual(respHeaders["x-custom"], "post-test");
});

test("new API: GET with minimal options", async () => {
	const api = createHttpApi(url);

	// Just params, no respHeaders - requires opts() wrapper
	const data = (await api.get(
		"/echo",
		opts({
			params: { raw: false },
		}),
	)) as Record<string, unknown>;

	assert.deepStrictEqual(data.message, "GET response");
});

test("new API: POST without data field (should work)", async () => {
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
	assert.ok(data === null || data === "");
});

test("backward compatibility: legacy GET API still works", async () => {
	const api = createHttpApi(url);
	const respHeaders: Record<string, string | number> = {};

	// Old API style (positional arguments)
	const data = (await api.get(
		"/echo",
		{ headers: { "x-custom": "legacy" } },
		respHeaders,
	)) as Record<string, unknown>;

	assert.deepStrictEqual(data.message, "GET response");
	assert.deepStrictEqual(respHeaders.__http_status_code__, 200);
	assert.deepStrictEqual(respHeaders["x-custom"], "legacy");
});

test("backward compatibility: legacy POST API still works", async () => {
	const api = createHttpApi(url);
	const respHeaders: Record<string, string | number> = {};

	// Old API style (positional arguments)
	const data = (await api.post(
		"/echo",
		{ name: "Jane" },
		{ headers: { "x-custom": "legacy-post" } },
		respHeaders,
	)) as Record<string, unknown>;

	assert.deepStrictEqual(data.name, "Jane");
	assert.deepStrictEqual(respHeaders.__http_status_code__, 200);
	assert.deepStrictEqual(respHeaders["x-custom"], "legacy-post");
});
