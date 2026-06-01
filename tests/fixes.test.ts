import { assert, assertEquals, assertRejects } from "@std/assert";
import { createHttpApi, HTTP_ERROR } from "../src/mod.ts";
import { getAvailablePort, hostname } from "./_helpers.ts";

/**
 * Echo server: reports back method, path, headers, body, and query.
 * Also handles special paths for empty-body (204) and slow (timeout) tests.
 */
function createEchoServer(port: number): Deno.HttpServer {
	const handler = async (req: Request): Promise<Response> => {
		const url = new URL(req.url);

		if (url.pathname === "/nocontent") {
			return new Response(null, { status: 204 });
		}

		if (url.pathname === "/slow") {
			const ms = Number(url.searchParams.get("ms")) || 500;
			await new Promise((r) => setTimeout(r, ms));
			return new Response("{}", {
				status: 200,
				headers: { "content-type": "application/json" },
			});
		}

		if (url.pathname === "/notfound") {
			return new Response('{"error":{"message":"nope"}}', {
				status: 404,
				headers: { "content-type": "application/json" },
			});
		}

		if (url.pathname === "/text") {
			return new Response("hello plain", {
				status: 200,
				headers: { "content-type": "text/plain" },
			});
		}

		const rawBody = await req.text();
		const payload = {
			method: req.method,
			pathname: url.pathname,
			search: url.search,
			query: Object.fromEntries(url.searchParams.entries()),
			contentType: req.headers.get("content-type"),
			body: rawBody,
			headers: Object.fromEntries(req.headers.entries()),
		};
		return new Response(JSON.stringify(payload), {
			status: 200,
			headers: { "content-type": "application/json" },
		});
	};
	return Deno.serve({ hostname, port, onListen: () => {} }, handler);
}

let url: string;
let server: Deno.HttpServer;

Deno.test.beforeEach(async () => {
	const port = await getAvailablePort();
	url = `http://${hostname}:${port}`;
	server = createEchoServer(port);
});

Deno.test.afterEach(async () => {
	// Reset global mutable state to avoid test pollution.
	createHttpApi.defaultErrorMessageExtractor = null;
	await server.shutdown();
});

type EchoResponse = {
	method: string;
	pathname: string;
	search: string;
	query: Record<string, string>;
	contentType: string | null;
	body: string;
	headers: Record<string, string>;
};

// B1: Falsy but valid data is not dropped.
Deno.test("B1: POST with data=0 sends '0' as JSON body", async () => {
	const api = createHttpApi(url);
	const r = (await api.post("/echo", 0)) as EchoResponse;
	assertEquals(r.body, "0");
	assertEquals(r.contentType, "application/json");
});

Deno.test("B1: POST with data=false sends 'false' as JSON body", async () => {
	const api = createHttpApi(url);
	const r = (await api.post("/echo", false)) as EchoResponse;
	assertEquals(r.body, "false");
	assertEquals(r.contentType, "application/json");
});

Deno.test("B1: POST with data=null sends no body", async () => {
	const api = createHttpApi(url);
	const r = (await api.post("/echo", null)) as EchoResponse;
	assertEquals(r.body, "");
});

// B2: User-provided Content-Type on object data is respected.
Deno.test("B2: user Content-Type is not overwritten for object data", async () => {
	const api = createHttpApi(url);
	const r = (await api.post(
		"/echo",
		{ a: 1 },
		{ headers: { "content-type": "application/ld+json" } },
	)) as EchoResponse;
	assertEquals(r.contentType, "application/ld+json");
	assertEquals(r.body, '{"a":1}');
});

// B3: String bodies are sent as-is, not JSON-stringified.
Deno.test("B3: string data is sent raw, not JSON-stringified", async () => {
	const api = createHttpApi(url);
	const r = (await api.post(
		"/echo",
		"hello",
		{ headers: { "content-type": "text/plain" } },
	)) as EchoResponse;
	assertEquals(r.body, "hello");
	assertEquals(r.contentType, "text/plain");
});

Deno.test("B3: string data with no content-type is sent raw (no default json)", async () => {
	const api = createHttpApi(url);
	const r = (await api.post("/echo", "<xml/>")) as EchoResponse;
	assertEquals(r.body, "<xml/>");
	// fetch may default content-type to text/plain; either way we did NOT set json.
	assert(r.contentType !== "application/json");
});

// B4: Native BodyInit types pass through correctly.
Deno.test("B4: URLSearchParams body is sent as form-urlencoded", async () => {
	const api = createHttpApi(url);
	const r = (await api.post(
		"/echo",
		new URLSearchParams({ a: "1", b: "hello world" }),
	)) as EchoResponse;
	assertEquals(r.body, "a=1&b=hello+world");
	assert((r.contentType ?? "").startsWith("application/x-www-form-urlencoded"));
});

Deno.test("B4: Uint8Array body is sent as binary", async () => {
	const api = createHttpApi(url);
	const bytes = new TextEncoder().encode("binary-payload");
	const r = (await api.post("/echo", bytes, {
		headers: { "content-type": "application/octet-stream" },
	})) as EchoResponse;
	assertEquals(r.body, "binary-payload");
	assertEquals(r.contentType, "application/octet-stream");
});

Deno.test("B4: Blob body is sent with its own content-type", async () => {
	const api = createHttpApi(url);
	const blob = new Blob(["blob-content"], { type: "text/markdown" });
	const r = (await api.post("/echo", blob)) as EchoResponse;
	assertEquals(r.body, "blob-content");
	assertEquals(r.contentType, "text/markdown");
});

// B5: Throwing extractor must not crash the call.
Deno.test("B5: throwing per-call extractor falls back, preserves HttpError type", async () => {
	const api = createHttpApi(url);
	try {
		await api.get(`/notfound`, undefined, undefined, () => {
			throw new Error("extractor broke");
		});
		assert(false, "must not reach");
	} catch (e) {
		assert(e instanceof HTTP_ERROR.NotFound);
		// Falls back to built-in which uses body.error.message
		assertEquals((e as Error).message, "nope");
	}
});

Deno.test("B5: throwing factory extractor falls back to built-in", async () => {
	const api = createHttpApi(url, undefined, () => {
		throw new Error("factory broke");
	});
	try {
		await api.get("/notfound");
		assert(false, "must not reach");
	} catch (e) {
		assert(e instanceof HTTP_ERROR.NotFound);
		assertEquals((e as Error).message, "nope");
	}
});

// B6: URL path normalization.
Deno.test("B6: trailing slash in base + leading slash in path → single slash", () => {
	const api = createHttpApi("http://api.example.com/v1/");
	assertEquals(api.url("/users"), "http://api.example.com/v1/users");
});

Deno.test("B6: missing leading slash in path is added", () => {
	const api = createHttpApi("http://api.example.com/v1");
	assertEquals(api.url("users"), "http://api.example.com/v1/users");
});

Deno.test("B6: multiple trailing slashes on base are collapsed", () => {
	const api = createHttpApi("http://api.example.com///");
	assertEquals(api.url("/users"), "http://api.example.com/users");
});

Deno.test("B6: absolute path URL bypasses base", () => {
	const api = createHttpApi("http://ignored/");
	assertEquals(api.url("https://other.example/x"), "https://other.example/x");
});

// B7: 204 No Content → null body.
Deno.test("B7: 204 No Content returns null, not empty string", async () => {
	const api = createHttpApi(url);
	const r = await api.get("/nocontent");
	assertEquals(r, null);
});

// D1: Timeout support.
Deno.test("D1: timeout aborts slow request with TimeoutError", async () => {
	const api = createHttpApi(url);
	await assertRejects(
		() => api.get("/slow?ms=2000", { timeout: 50 }),
		// Should abort; the exact error type is DOMException/TimeoutError depending on runtime.
		Error,
	);
});

Deno.test("D1: user signal still works alongside timeout", async () => {
	const api = createHttpApi(url);
	const ctrl = new AbortController();
	const promise = api.get("/slow?ms=2000", {
		timeout: 5000,
		signal: ctrl.signal,
	});
	setTimeout(() => ctrl.abort(), 20);
	await assertRejects(() => promise, Error);
});

// I1: Query params.
Deno.test("I1: query object is appended as URL search params", async () => {
	const api = createHttpApi(url);
	const r = (await api.get("/echo", {
		query: { page: 1, q: "hello world", active: true },
	})) as EchoResponse;
	assertEquals(r.query.page, "1");
	assertEquals(r.query.q, "hello world");
	assertEquals(r.query.active, "true");
});

Deno.test("I1: null/undefined query values are skipped", async () => {
	const api = createHttpApi(url);
	const r = (await api.get("/echo", {
		query: { a: 1, b: null, c: undefined },
	})) as EchoResponse;
	assertEquals(r.search, "?a=1");
});

Deno.test("I1: array query values become repeated keys", async () => {
	const api = createHttpApi(url);
	const r = (await api.get("/echo", {
		query: { tag: ["a", "b", "c"] },
	})) as EchoResponse;
	assertEquals(r.search, "?tag=a&tag=b&tag=c");
});

Deno.test("I1: query merges with existing ? in path", async () => {
	const api = createHttpApi(url);
	const r = (await api.get("/echo?foo=1", {
		query: { bar: "2" },
	})) as EchoResponse;
	assert(r.search.includes("foo=1"));
	assert(r.search.includes("bar=2"));
});

// Interceptors.
Deno.test("interceptors: onRequest can mutate headers", async () => {
	const api = createHttpApi(url).onRequest((init) => {
		const h = new Headers(init.headers);
		h.set("x-injected", "yes");
		return { ...init, headers: h };
	});
	const r = (await api.get("/echo")) as EchoResponse;
	assertEquals(r.headers["x-injected"], "yes");
});

Deno.test("interceptors: onResponse can replace the response", async () => {
	const api = createHttpApi(url).onResponse((resp) => {
		if (resp.status === 404) {
			return new Response('{"replaced":true}', {
				status: 200,
				headers: { "content-type": "application/json" },
			});
		}
	});
	const r = (await api.get("/notfound")) as { replaced: boolean };
	assertEquals(r.replaced, true);
});

// D3/test hygiene: global extractor is now reset via afterEach,
// but verify it scopes correctly within a single test.
Deno.test("global extractor is used only when per-instance is absent", async () => {
	createHttpApi.defaultErrorMessageExtractor = () => "GLOBAL";
	const instanceApi = createHttpApi(url, undefined, () => "INSTANCE");
	try {
		await instanceApi.get("/notfound");
		assert(false);
	} catch (e) {
		assertEquals((e as Error).message, "INSTANCE");
	}

	const plainApi = createHttpApi(url);
	try {
		await plainApi.get("/notfound");
		assert(false);
	} catch (e) {
		assertEquals((e as Error).message, "GLOBAL");
	}
});
