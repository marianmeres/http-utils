import { assert, assertEquals, assertStringIncludes } from "@std/assert";
import { createHttpApi, HTTP_ERROR, type HttpErrorCause } from "../src/mod.ts";
import { getAvailablePort, hostname } from "./_helpers.ts";

const ERR_MSG = "Bot backend unavailable";

function createTestServer(port: number): Deno.HttpServer {
	const handler = (req: Request): Response => {
		const u = new URL(req.url);
		const headers = new Headers({ "Content-Type": "application/json" });

		// 302 -> /fail, so we can assert the post-redirect URL
		if (u.pathname === "/redirect") {
			return new Response(null, {
				status: 302,
				headers: { location: "/fail?redirected=1" },
			});
		}

		// Deliberately longer than the built-in 255 char cap.
		if (u.pathname === "/long") {
			const long = "x".repeat(400);
			return new Response(JSON.stringify({ error: { message: long } }), {
				status: 502,
				headers,
			});
		}

		return new Response(JSON.stringify({ error: { message: ERR_MSG } }), {
			status: 502,
			headers,
		});
	};

	return Deno.serve({ hostname, port, onListen: () => {} }, handler);
}

let url: string;
let server: Deno.HttpServer;

Deno.test.beforeEach(async () => {
	const port = await getAvailablePort();
	url = `http://${hostname}:${port}`;
	server = createTestServer(port);
});

Deno.test.afterEach(async () => {
	// Global state is shared process-wide (Symbol.for on globalThis) — never
	// let a flag leak into another test file.
	createHttpApi.global.appendUrlToErrorMessage = false;
	createHttpApi.defaultErrorMessageExtractor = null;
	await server.shutdown();
});

/** Runs `fn`, asserting it throws an HttpError, and returns it. */
async function catchHttpError(fn: () => Promise<unknown>) {
	try {
		await fn();
		throw new Error("Expected to throw");
	} catch (e) {
		assert(e instanceof HTTP_ERROR.HttpError, `Not an HttpError: ${e}`);
		return e;
	}
}

// --- (1) cause.url ---

Deno.test("cause.url is present and fully resolved on a non-2xx throw", async () => {
	const api = createHttpApi(url);
	const e = await catchHttpError(() => api.get("/fail"));

	const cause = e.cause as HttpErrorCause;
	assertEquals(cause.url, `${url}/fail`);
	assertEquals(cause.method, "GET");
	assertEquals(cause.response.status, 502);
});

Deno.test("cause.url includes the query string (cause.path does not)", async () => {
	const api = createHttpApi(url);
	const e = await catchHttpError(() =>
		api.get("/fail", { query: { educationId: "abc", tag: ["x", "y"] } })
	);

	const cause = e.cause as HttpErrorCause;
	assertEquals(cause.url, `${url}/fail?educationId=abc&tag=x&tag=y`);
	// Pinned deliberately: `path` is the pre-query value, which is exactly why
	// `url` exists. If this ever starts including the query, revisit the docs.
	assertEquals(cause.path, `${url}/fail`);
});

Deno.test("cause.url reflects the post-redirect URL", async () => {
	const api = createHttpApi(url);
	const e = await catchHttpError(() => api.get("/redirect"));

	const cause = e.cause as HttpErrorCause;
	assertEquals(cause.url, `${url}/fail?redirected=1`);
	assertEquals(cause.path, `${url}/redirect`);
});

Deno.test("cause.url falls back to the requested URL for a synthetic response", async () => {
	// A response interceptor may return a `new Response(...)`, whose `.url` is
	// always "". The requested URL must be used instead of an empty string.
	const api = createHttpApi(url).onResponse(() =>
		new Response('{"error":{"message":"replaced"}}', {
			status: 503,
			headers: { "Content-Type": "application/json" },
		})
	);
	const e = await catchHttpError(() => api.get("/fail", { query: { a: 1 } }));

	const cause = e.cause as HttpErrorCause;
	assertEquals(cause.url, `${url}/fail?a=1`);
	assertEquals(cause.response.status, 503);
});

// --- (2) appendUrlToErrorMessage ---

Deno.test("appendUrlToErrorMessage off (default): message is unchanged", async () => {
	const api = createHttpApi(url);
	const e = await catchHttpError(() => api.get("/fail", { query: { a: 1 } }));

	// Byte-identical to pre-2.12 behavior: server message only.
	assertEquals(e.message, ERR_MSG);
});

Deno.test("appendUrlToErrorMessage on: URL appended to built-in extraction", async () => {
	createHttpApi.global.appendUrlToErrorMessage = true;
	const api = createHttpApi(url);
	const e = await catchHttpError(() => api.get("/fail", { query: { a: 1 } }));

	assertEquals(e.message, `${ERR_MSG} (GET ${url}/fail?a=1)`);
});

Deno.test("appendUrlToErrorMessage decorates a per-call extractor", async () => {
	createHttpApi.global.appendUrlToErrorMessage = true;
	const api = createHttpApi(url);
	const e = await catchHttpError(() =>
		api.get("/fail", undefined, null, () => "per-call")
	);

	assertEquals(e.message, `per-call (GET ${url}/fail)`);
});

Deno.test("appendUrlToErrorMessage decorates a factory extractor", async () => {
	createHttpApi.global.appendUrlToErrorMessage = true;
	const api = createHttpApi(url, undefined, () => "factory");
	const e = await catchHttpError(() => api.post("/fail", { a: 1 }));

	assertEquals(e.message, `factory (POST ${url}/fail)`);
});

Deno.test("appendUrlToErrorMessage decorates defaultErrorMessageExtractor", async () => {
	createHttpApi.global.appendUrlToErrorMessage = true;
	createHttpApi.defaultErrorMessageExtractor = () => "default";
	const api = createHttpApi(url);
	const e = await catchHttpError(() => api.get("/fail"));

	assertEquals(e.message, `default (GET ${url}/fail)`);
});

Deno.test("appendUrlToErrorMessage: long message is truncated, URL kept whole", async () => {
	createHttpApi.global.appendUrlToErrorMessage = true;
	const api = createHttpApi(url);
	const e = await catchHttpError(() => api.get("/long"));

	assertStringIncludes(e.message, "[Shortened]: ");
	// The whole URL survives the cap.
	assert(
		e.message.endsWith(` (GET ${url}/long)`),
		`URL not intact: ${e.message.slice(-80)}`,
	);
});

Deno.test("appendUrlToErrorMessage: NetworkError message is unchanged (no double URL)", async () => {
	// Nothing listening here — a transport failure, not an HTTP error.
	const port = await getAvailablePort();
	const dead = `http://${hostname}:${port}`;
	const api = createHttpApi(dead);

	createHttpApi.global.appendUrlToErrorMessage = false;
	const off = await catchHttpError(() => api.get("/fail"));

	createHttpApi.global.appendUrlToErrorMessage = true;
	const on = await catchHttpError(() => api.get("/fail"));

	assert(on instanceof HTTP_ERROR.NetworkError, `Not a NetworkError: ${on.name}`);
	// fetchOrThrow already embeds the URL; the flag must not decorate it again.
	assertStringIncludes(on.message, `GET unreachable (${dead}/fail)`);
	assertEquals(on.message, off.message);
	assert(
		!on.message.endsWith(`(GET ${dead}/fail)`),
		`Message was decorated a second time: ${on.message}`,
	);
});

// --- (2b) appendUrlToErrorMessage as a formatter function ---

Deno.test("appendUrlToErrorMessage formatter renders the appended text", async () => {
	createHttpApi.global.appendUrlToErrorMessage = ({ method, url }) =>
		`${method} ${url.split("?")[0]}`; // redact the query string
	const api = createHttpApi(url);
	const e = await catchHttpError(() =>
		api.get("/fail", { query: { token: "s3cret" } })
	);

	assertEquals(e.message, `${ERR_MSG} (GET ${url}/fail)`);
	// The secret must not survive anywhere in the message.
	assert(!e.message.includes("s3cret"), e.message);
	// ...but `cause.url` is untouched — it is not a message.
	assertEquals((e.cause as HttpErrorCause).url, `${url}/fail?token=s3cret`);
});

Deno.test("appendUrlToErrorMessage formatter receives the full request context", async () => {
	let seen: Record<string, unknown> | null = null;
	createHttpApi.global.appendUrlToErrorMessage = (info) => {
		seen = { ...info };
		return info.url;
	};
	const api = createHttpApi(url);
	await catchHttpError(() => api.post("/fail", { a: 1 }, { query: { b: 2 } }));

	assertEquals(seen, {
		url: `${url}/fail?b=2`,
		method: "POST",
		path: `${url}/fail`,
		status: 502,
	});
});

Deno.test("appendUrlToErrorMessage formatter can skip the append per error", async () => {
	// Only decorate server errors — this one is a 502, so it IS decorated;
	// an empty return skips the parentheses entirely.
	createHttpApi.global.appendUrlToErrorMessage = ({ status, url }) =>
		status >= 500 ? url : "";
	const api = createHttpApi(url);
	const decorated = await catchHttpError(() => api.get("/fail"));
	assertEquals(decorated.message, `${ERR_MSG} (${url}/fail)`);

	createHttpApi.global.appendUrlToErrorMessage = () => "";
	const plain = await catchHttpError(() => api.get("/fail"));
	assertEquals(plain.message, ERR_MSG);
});

Deno.test("appendUrlToErrorMessage formatter returning a non-string skips the append", async () => {
	// deno-lint-ignore no-explicit-any
	createHttpApi.global.appendUrlToErrorMessage = (() => undefined) as any;
	const api = createHttpApi(url);
	const e = await catchHttpError(() => api.get("/fail"));

	assertEquals(e.message, ERR_MSG);
});

Deno.test("appendUrlToErrorMessage: a throwing formatter fails closed (no raw URL)", async () => {
	createHttpApi.global.appendUrlToErrorMessage = () => {
		throw new Error("broken redactor");
	};
	const api = createHttpApi(url);
	const e = await catchHttpError(() =>
		api.get("/fail", { query: { token: "s3cret" } })
	);

	// The real HTTP error survives untouched...
	assertEquals(e.message, ERR_MSG);
	assertEquals(e.status, 502);
	// ...and crucially does NOT fall back to appending the unredacted URL.
	assert(!e.message.includes("s3cret"), e.message);
});

Deno.test("appendUrlToErrorMessage formatter decorates a per-call extractor too", async () => {
	createHttpApi.global.appendUrlToErrorMessage = ({ url }) => `at ${url}`;
	const api = createHttpApi(url);
	const e = await catchHttpError(() =>
		api.get("/fail", undefined, null, () => "per-call")
	);

	assertEquals(e.message, `per-call (at ${url}/fail)`);
});

Deno.test("createHttpApi.global is shared across instances", async () => {
	const a = createHttpApi(url);
	const b = createHttpApi(url);

	createHttpApi.global.appendUrlToErrorMessage = true;

	const ea = await catchHttpError(() => a.get("/fail"));
	const eb = await catchHttpError(() => b.get("/fail"));

	assertEquals(ea.message, `${ERR_MSG} (GET ${url}/fail)`);
	assertEquals(eb.message, `${ERR_MSG} (GET ${url}/fail)`);

	// Same object behind the Symbol.for key, not a per-import copy.
	const key = Symbol.for("@marianmeres/http-utils/createHttpApi");
	// deno-lint-ignore no-explicit-any
	assert((globalThis as any)[key] === createHttpApi.global);
});
