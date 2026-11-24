import assert from "node:assert/strict";
import { afterEach, beforeEach, test } from "node:test";
import { createHttpApi, HTTP_ERROR } from "../src/mod.ts";
import { hostname, serve, type TestServer } from "./_helpers.ts";

/**
 * Echo server: reports back method, path, headers, body, and query.
 * Also handles special paths for empty-body (204) and slow (timeout) tests.
 */
function createEchoServer(): Promise<TestServer> {
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
	return serve({ hostname }, handler);
}

let url: string;
let server: TestServer;

beforeEach(async () => {
	server = await createEchoServer();
	url = `http://${hostname}:${server.port}`;
});

afterEach(async () => {
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
test("B1: POST with data=0 sends '0' as JSON body", async () => {
	const api = createHttpApi(url);
	const r = (await api.post("/echo", 0)) as EchoResponse;
	assert.deepStrictEqual(r.body, "0");
	assert.deepStrictEqual(r.contentType, "application/json");
});

test("B1: POST with data=false sends 'false' as JSON body", async () => {
	const api = createHttpApi(url);
	const r = (await api.post("/echo", false)) as EchoResponse;
	assert.deepStrictEqual(r.body, "false");
	assert.deepStrictEqual(r.contentType, "application/json");
});

test("B1: POST with data=null sends no body", async () => {
	const api = createHttpApi(url);
	const r = (await api.post("/echo", null)) as EchoResponse;
	assert.deepStrictEqual(r.body, "");
});

// B2: User-provided Content-Type on object data is respected.
test("B2: user Content-Type is not overwritten for object data", async () => {
	const api = createHttpApi(url);
	const r = (await api.post(
		"/echo",
		{ a: 1 },
		{ headers: { "content-type": "application/ld+json" } },
	)) as EchoResponse;
	assert.deepStrictEqual(r.contentType, "application/ld+json");
	assert.deepStrictEqual(r.body, '{"a":1}');
});

// B3: String bodies are sent as-is, not JSON-stringified.
test("B3: string data is sent raw, not JSON-stringified", async () => {
	const api = createHttpApi(url);
	const r = (await api.post("/echo", "hello", {
		headers: { "content-type": "text/plain" },
	})) as EchoResponse;
	assert.deepStrictEqual(r.body, "hello");
	assert.deepStrictEqual(r.contentType, "text/plain");
});

test("B3: string data with no content-type is sent raw (no default json)", async () => {
	const api = createHttpApi(url);
	const r = (await api.post("/echo", "<xml/>")) as EchoResponse;
	assert.deepStrictEqual(r.body, "<xml/>");
	// fetch may default content-type to text/plain; either way we did NOT set json.
	assert.ok(r.contentType !== "application/json");
});

// B4: Native BodyInit types pass through correctly.
test("B4: URLSearchParams body is sent as form-urlencoded", async () => {
	const api = createHttpApi(url);
	const r = (await api.post(
		"/echo",
		new URLSearchParams({ a: "1", b: "hello world" }),
	)) as EchoResponse;
	assert.deepStrictEqual(r.body, "a=1&b=hello+world");
	assert.ok((r.contentType ?? "").startsWith("application/x-www-form-urlencoded"));
});

test("B4: Uint8Array body is sent as binary", async () => {
	const api = createHttpApi(url);
	const bytes = new TextEncoder().encode("binary-payload");
	const r = (await api.post("/echo", bytes, {
		headers: { "content-type": "application/octet-stream" },
	})) as EchoResponse;
	assert.deepStrictEqual(r.body, "binary-payload");
	assert.deepStrictEqual(r.contentType, "application/octet-stream");
});

test("B4: Blob body is sent with its own content-type", async () => {
	const api = createHttpApi(url);
	const blob = new Blob(["blob-content"], { type: "text/markdown" });
	const r = (await api.post("/echo", blob)) as EchoResponse;
	assert.deepStrictEqual(r.body, "blob-content");
	assert.deepStrictEqual(r.contentType, "text/markdown");
});

// B5: Throwing extractor must not crash the call.
test("B5: throwing per-call extractor falls back, preserves HttpError type", async () => {
	const api = createHttpApi(url);
	try {
		await api.get(`/notfound`, undefined, undefined, () => {
			throw new Error("extractor broke");
		});
		assert.ok(false, "must not reach");
	} catch (e) {
		assert.ok(e instanceof HTTP_ERROR.NotFound);
		// Falls back to built-in which uses body.error.message
		assert.deepStrictEqual((e as Error).message, "nope");
	}
});

test("B5: throwing factory extractor falls back to built-in", async () => {
	const api = createHttpApi(url, undefined, () => {
		throw new Error("factory broke");
	});
	try {
		await api.get("/notfound");
		assert.ok(false, "must not reach");
	} catch (e) {
		assert.ok(e instanceof HTTP_ERROR.NotFound);
		assert.deepStrictEqual((e as Error).message, "nope");
	}
});

// B6: URL path normalization.
test("B6: trailing slash in base + leading slash in path → single slash", () => {
	const api = createHttpApi("http://api.example.com/v1/");
	assert.deepStrictEqual(api.url("/users"), "http://api.example.com/v1/users");
});

test("B6: missing leading slash in path is added", () => {
	const api = createHttpApi("http://api.example.com/v1");
	assert.deepStrictEqual(api.url("users"), "http://api.example.com/v1/users");
});

test("B6: multiple trailing slashes on base are collapsed", () => {
	const api = createHttpApi("http://api.example.com///");
	assert.deepStrictEqual(api.url("/users"), "http://api.example.com/users");
});

test("B6: absolute path URL bypasses base", () => {
	const api = createHttpApi("http://ignored/");
	assert.deepStrictEqual(api.url("https://other.example/x"), "https://other.example/x");
});

// B7: 204 No Content → null body.
test("B7: 204 No Content returns null, not empty string", async () => {
	const api = createHttpApi(url);
	const r = await api.get("/nocontent");
	assert.deepStrictEqual(r, null);
});

// D1: Timeout support.
test("D1: timeout aborts slow request with TimeoutError", async () => {
	const api = createHttpApi(url);
	await assert.rejects(
		() => api.get("/slow?ms=2000", { timeout: 50 }),
		// Should abort; the exact error type is DOMException/TimeoutError depending on runtime.
		Error,
	);
});

test("D1: user signal still works alongside timeout", async () => {
	const api = createHttpApi(url);
	const ctrl = new AbortController();
	const promise = api.get("/slow?ms=2000", {
		timeout: 5000,
		signal: ctrl.signal,
	});
	setTimeout(() => ctrl.abort(), 20);
	await assert.rejects(() => promise, Error);
});

// I1: Query params.
test("I1: query object is appended as URL search params", async () => {
	const api = createHttpApi(url);
	const r = (await api.get("/echo", {
		query: { page: 1, q: "hello world", active: true },
	})) as EchoResponse;
	assert.deepStrictEqual(r.query.page, "1");
	assert.deepStrictEqual(r.query.q, "hello world");
	assert.deepStrictEqual(r.query.active, "true");
});

test("I1: null/undefined query values are skipped", async () => {
	const api = createHttpApi(url);
	const r = (await api.get("/echo", {
		query: { a: 1, b: null, c: undefined },
	})) as EchoResponse;
	assert.deepStrictEqual(r.search, "?a=1");
});

test("I1: array query values become repeated keys", async () => {
	const api = createHttpApi(url);
	const r = (await api.get("/echo", {
		query: { tag: ["a", "b", "c"] },
	})) as EchoResponse;
	assert.deepStrictEqual(r.search, "?tag=a&tag=b&tag=c");
});

test("I1: query merges with existing ? in path", async () => {
	const api = createHttpApi(url);
	const r = (await api.get("/echo?foo=1", {
		query: { bar: "2" },
	})) as EchoResponse;
	assert.ok(r.search.includes("foo=1"));
	assert.ok(r.search.includes("bar=2"));
});

// Interceptors.
test("interceptors: onRequest can mutate headers", async () => {
	const api = createHttpApi(url).onRequest((init) => {
		const h = new Headers(init.headers);
		h.set("x-injected", "yes");
		return { ...init, headers: h };
	});
	const r = (await api.get("/echo")) as EchoResponse;
	assert.deepStrictEqual(r.headers["x-injected"], "yes");
});

test("interceptors: onResponse can replace the response", async () => {
	const api = createHttpApi(url).onResponse((resp) => {
		if (resp.status === 404) {
			return new Response('{"replaced":true}', {
				status: 200,
				headers: { "content-type": "application/json" },
			});
		}
	});
	const r = (await api.get("/notfound")) as { replaced: boolean };
	assert.deepStrictEqual(r.replaced, true);
});

// D3/test hygiene: global extractor is now reset via afterEach,
// but verify it scopes correctly within a single test.
test("global extractor is used only when per-instance is absent", async () => {
	createHttpApi.defaultErrorMessageExtractor = () => "GLOBAL";
	const instanceApi = createHttpApi(url, undefined, () => "INSTANCE");
	try {
		await instanceApi.get("/notfound");
		assert.ok(false);
	} catch (e) {
		assert.deepStrictEqual((e as Error).message, "INSTANCE");
	}

	const plainApi = createHttpApi(url);
	try {
		await plainApi.get("/notfound");
		assert.ok(false);
	} catch (e) {
		assert.deepStrictEqual((e as Error).message, "GLOBAL");
	}
});
