import { assert, assertEquals } from "@std/assert";
import { createHttpApi } from "../src/index.ts";

const hostname = "127.0.0.1";

// Helper to find available port
async function getAvailablePort(): Promise<number> {
	const listener = Deno.listen({ hostname, port: 0 });
	const port = (listener.addr as Deno.NetAddr).port;
	listener.close();
	return port;
}

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

Deno.test("new API: GET with options object", async () => {
	const port = await getAvailablePort();
	const url = `http://${hostname}:${port}`;
	const server = await createTestServer(port);

	try {
		const api = createHttpApi(url);
		const respHeaders: any = {};

		// New API style
		const data = await api.get("/echo", {
			params: { headers: { "x-custom": "test-value" } },
			respHeaders,
		});

		assertEquals(data.message, "GET response");
		assertEquals(respHeaders.__http_status_code__, 200);
		assertEquals(respHeaders["x-custom"], "test-value");
	} finally {
		await server.shutdown();
	}
});

Deno.test("new API: POST with options object", async () => {
	const port = await getAvailablePort();
	const url = `http://${hostname}:${port}`;
	const server = await createTestServer(port);

	try {
		const api = createHttpApi(url);
		const respHeaders: any = {};

		// New API style
		const data = await api.post("/echo", {
			data: { name: "John", age: 30 },
			params: { headers: { "x-custom": "post-test" } },
			respHeaders,
		});

		assertEquals(data.name, "John");
		assertEquals(data.age, 30);
		assertEquals(respHeaders.__http_status_code__, 200);
		assertEquals(respHeaders["x-custom"], "post-test");
	} finally {
		await server.shutdown();
	}
});

Deno.test("new API: GET with minimal options", async () => {
	const port = await getAvailablePort();
	const url = `http://${hostname}:${port}`;
	const server = await createTestServer(port);

	try {
		const api = createHttpApi(url);

		// Just params, no respHeaders
		const data = await api.get("/echo", {
			params: { raw: false },
		});

		assertEquals(data.message, "GET response");
	} finally {
		await server.shutdown();
	}
});

Deno.test("new API: POST without data field (should work)", async () => {
	const port = await getAvailablePort();
	const url = `http://${hostname}:${port}`;
	const server = await createTestServer(port);

	try {
		const api = createHttpApi(url);

		// Options object without data field (data will be null)
		const data = await api.post("/echo", {
			params: { headers: { "x-custom": "no-data" } },
		});

		// Server echoes empty body (JSON.stringify(null) = "null", but empty body might be "")
		// Just verify it doesn't crash
		assert(data === null || data === "");
	} finally {
		await server.shutdown();
	}
});

Deno.test("backward compatibility: legacy GET API still works", async () => {
	const port = await getAvailablePort();
	const url = `http://${hostname}:${port}`;
	const server = await createTestServer(port);

	try {
		const api = createHttpApi(url);
		const respHeaders: any = {};

		// Old API style (positional arguments)
		const data = await api.get(
			"/echo",
			{ headers: { "x-custom": "legacy" } },
			respHeaders
		);

		assertEquals(data.message, "GET response");
		assertEquals(respHeaders.__http_status_code__, 200);
		assertEquals(respHeaders["x-custom"], "legacy");
	} finally {
		await server.shutdown();
	}
});

Deno.test("backward compatibility: legacy POST API still works", async () => {
	const port = await getAvailablePort();
	const url = `http://${hostname}:${port}`;
	const server = await createTestServer(port);

	try {
		const api = createHttpApi(url);
		const respHeaders: any = {};

		// Old API style (positional arguments)
		const data = await api.post(
			"/echo",
			{ name: "Jane" },
			{ headers: { "x-custom": "legacy-post" } },
			respHeaders
		);

		assertEquals(data.name, "Jane");
		assertEquals(respHeaders.__http_status_code__, 200);
		assertEquals(respHeaders["x-custom"], "legacy-post");
	} finally {
		await server.shutdown();
	}
});
