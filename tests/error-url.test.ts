import assert from "node:assert/strict";
import { afterEach, beforeEach, test } from "node:test";
import { createHttpApi, HTTP_ERROR, type HttpErrorCause } from "../src/mod.ts";
import { getAvailablePort, hostname, serve, type TestServer } from "./_helpers.ts";

const ERR_MSG = "Bot backend unavailable";

function createTestServer(): Promise<TestServer> {
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

	return serve({ hostname }, handler);
}

let url: string;
let server: TestServer;

beforeEach(async () => {
	server = await createTestServer();
	url = `http://${hostname}:${server.port}`;
});

afterEach(async () => {
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
		assert.ok(e instanceof HTTP_ERROR.HttpError, `Not an HttpError: ${e}`);
		return e;
	}
}

// --- (1) cause.url ---

test("cause.url is present and fully resolved on a non-2xx throw", async () => {
	const api = createHttpApi(url);
	const e = await catchHttpError(() => api.get("/fail"));

	const cause = e.cause as HttpErrorCause;
	assert.deepStrictEqual(cause.url, `${url}/fail`);
	assert.deepStrictEqual(cause.method, "GET");
	assert.deepStrictEqual(cause.response.status, 502);
});

test("cause.url includes the query string (cause.path does not)", async () => {
	const api = createHttpApi(url);
	const e = await catchHttpError(() =>
		api.get("/fail", { query: { educationId: "abc", tag: ["x", "y"] } })
	);

	const cause = e.cause as HttpErrorCause;
	assert.deepStrictEqual(cause.url, `${url}/fail?educationId=abc&tag=x&tag=y`);
	// Pinned deliberately: `path` is the pre-query value, which is exactly why
	// `url` exists. If this ever starts including the query, revisit the docs.
	assert.deepStrictEqual(cause.path, `${url}/fail`);
});

test("cause.url reflects the post-redirect URL", async () => {
	const api = createHttpApi(url);
	const e = await catchHttpError(() => api.get("/redirect"));

	const cause = e.cause as HttpErrorCause;
	assert.deepStrictEqual(cause.url, `${url}/fail?redirected=1`);
	assert.deepStrictEqual(cause.path, `${url}/redirect`);
});

test("cause.url falls back to the requested URL for a synthetic response", async () => {
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
	assert.deepStrictEqual(cause.url, `${url}/fail?a=1`);
	assert.deepStrictEqual(cause.response.status, 503);
});

// --- (2) appendUrlToErrorMessage ---

test("appendUrlToErrorMessage off (default): message is unchanged", async () => {
	const api = createHttpApi(url);
	const e = await catchHttpError(() => api.get("/fail", { query: { a: 1 } }));

	// Byte-identical to pre-2.12 behavior: server message only.
	assert.deepStrictEqual(e.message, ERR_MSG);
});

test("appendUrlToErrorMessage on: URL appended to built-in extraction", async () => {
	createHttpApi.global.appendUrlToErrorMessage = true;
	const api = createHttpApi(url);
	const e = await catchHttpError(() => api.get("/fail", { query: { a: 1 } }));

	assert.deepStrictEqual(e.message, `${ERR_MSG} (GET ${url}/fail?a=1)`);
});

test("appendUrlToErrorMessage decorates a per-call extractor", async () => {
	createHttpApi.global.appendUrlToErrorMessage = true;
	const api = createHttpApi(url);
	const e = await catchHttpError(() =>
		api.get("/fail", undefined, null, () => "per-call")
	);

	assert.deepStrictEqual(e.message, `per-call (GET ${url}/fail)`);
});

test("appendUrlToErrorMessage decorates a factory extractor", async () => {
	createHttpApi.global.appendUrlToErrorMessage = true;
	const api = createHttpApi(url, undefined, () => "factory");
	const e = await catchHttpError(() => api.post("/fail", { a: 1 }));

	assert.deepStrictEqual(e.message, `factory (POST ${url}/fail)`);
});

test("appendUrlToErrorMessage decorates defaultErrorMessageExtractor", async () => {
	createHttpApi.global.appendUrlToErrorMessage = true;
	createHttpApi.defaultErrorMessageExtractor = () => "default";
	const api = createHttpApi(url);
	const e = await catchHttpError(() => api.get("/fail"));

	assert.deepStrictEqual(e.message, `default (GET ${url}/fail)`);
});

test("appendUrlToErrorMessage: long message is truncated, URL kept whole", async () => {
	createHttpApi.global.appendUrlToErrorMessage = true;
	const api = createHttpApi(url);
	const e = await catchHttpError(() => api.get("/long"));

	assert.ok(e.message.includes("[Shortened]: "));
	// The whole URL survives the cap.
	assert.ok(
		e.message.endsWith(` (GET ${url}/long)`),
		`URL not intact: ${e.message.slice(-80)}`,
	);
});

test("appendUrlToErrorMessage: NetworkError message is unchanged (no double URL)", async () => {
	// Nothing listening here — a transport failure, not an HTTP error.
	const port = await getAvailablePort();
	const dead = `http://${hostname}:${port}`;
	const api = createHttpApi(dead);

	createHttpApi.global.appendUrlToErrorMessage = false;
	const off = await catchHttpError(() => api.get("/fail"));

	createHttpApi.global.appendUrlToErrorMessage = true;
	const on = await catchHttpError(() => api.get("/fail"));

	assert.ok(on instanceof HTTP_ERROR.NetworkError, `Not a NetworkError: ${on.name}`);
	// fetchOrThrow already embeds the URL; the flag must not decorate it again.
	assert.ok(on.message.includes(`GET unreachable (${dead}/fail)`));
	assert.deepStrictEqual(on.message, off.message);
	assert.ok(
		!on.message.endsWith(`(GET ${dead}/fail)`),
		`Message was decorated a second time: ${on.message}`,
	);
});

// --- (2b) appendUrlToErrorMessage as a formatter function ---

test("appendUrlToErrorMessage formatter renders the appended text", async () => {
	createHttpApi.global.appendUrlToErrorMessage = ({ method, url }) =>
		`${method} ${url.split("?")[0]}`; // redact the query string
	const api = createHttpApi(url);
	const e = await catchHttpError(() =>
		api.get("/fail", { query: { token: "s3cret" } })
	);

	assert.deepStrictEqual(e.message, `${ERR_MSG} (GET ${url}/fail)`);
	// The secret must not survive anywhere in the message.
	assert.ok(!e.message.includes("s3cret"), e.message);
	// ...but `cause.url` is untouched — it is not a message.
	assert.deepStrictEqual((e.cause as HttpErrorCause).url, `${url}/fail?token=s3cret`);
});

test("appendUrlToErrorMessage formatter receives the full request context", async () => {
	let seen: Record<string, unknown> | null = null;
	createHttpApi.global.appendUrlToErrorMessage = (info) => {
		seen = { ...info };
		return info.url;
	};
	const api = createHttpApi(url);
	await catchHttpError(() => api.post("/fail", { a: 1 }, { query: { b: 2 } }));

	assert.deepStrictEqual(seen, {
		url: `${url}/fail?b=2`,
		method: "POST",
		path: `${url}/fail`,
		status: 502,
	});
});

test("appendUrlToErrorMessage formatter can skip the append per error", async () => {
	// Only decorate server errors — this one is a 502, so it IS decorated;
	// an empty return skips the parentheses entirely.
	createHttpApi.global.appendUrlToErrorMessage = ({ status, url }) =>
		status >= 500 ? url : "";
	const api = createHttpApi(url);
	const decorated = await catchHttpError(() => api.get("/fail"));
	assert.deepStrictEqual(decorated.message, `${ERR_MSG} (${url}/fail)`);

	createHttpApi.global.appendUrlToErrorMessage = () => "";
	const plain = await catchHttpError(() => api.get("/fail"));
	assert.deepStrictEqual(plain.message, ERR_MSG);
});

test("appendUrlToErrorMessage formatter returning a non-string skips the append", async () => {
	// deno-lint-ignore no-explicit-any
	createHttpApi.global.appendUrlToErrorMessage = (() => undefined) as any;
	const api = createHttpApi(url);
	const e = await catchHttpError(() => api.get("/fail"));

	assert.deepStrictEqual(e.message, ERR_MSG);
});

test("appendUrlToErrorMessage: a throwing formatter fails closed (no raw URL)", async () => {
	createHttpApi.global.appendUrlToErrorMessage = () => {
		throw new Error("broken redactor");
	};
	const api = createHttpApi(url);
	const e = await catchHttpError(() =>
		api.get("/fail", { query: { token: "s3cret" } })
	);

	// The real HTTP error survives untouched...
	assert.deepStrictEqual(e.message, ERR_MSG);
	assert.deepStrictEqual(e.status, 502);
	// ...and crucially does NOT fall back to appending the unredacted URL.
	assert.ok(!e.message.includes("s3cret"), e.message);
});

test("appendUrlToErrorMessage formatter decorates a per-call extractor too", async () => {
	createHttpApi.global.appendUrlToErrorMessage = ({ url }) => `at ${url}`;
	const api = createHttpApi(url);
	const e = await catchHttpError(() =>
		api.get("/fail", undefined, null, () => "per-call")
	);

	assert.deepStrictEqual(e.message, `per-call (at ${url}/fail)`);
});

test("createHttpApi.global is shared across instances", async () => {
	const a = createHttpApi(url);
	const b = createHttpApi(url);

	createHttpApi.global.appendUrlToErrorMessage = true;

	const ea = await catchHttpError(() => a.get("/fail"));
	const eb = await catchHttpError(() => b.get("/fail"));

	assert.deepStrictEqual(ea.message, `${ERR_MSG} (GET ${url}/fail)`);
	assert.deepStrictEqual(eb.message, `${ERR_MSG} (GET ${url}/fail)`);

	// Same object behind the Symbol.for key, not a per-import copy.
	const key = Symbol.for("@marianmeres/http-utils/createHttpApi");
	// deno-lint-ignore no-explicit-any
	assert.ok((globalThis as any)[key] === createHttpApi.global);
});
