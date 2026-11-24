import assert from "node:assert/strict";
import { test } from "node:test";
import { fetchOrThrow } from "../src/mod.ts";
import { getErrorMessage, HTTP_ERROR } from "../src/error.ts";
import { serve } from "./_helpers.ts";

// Reserved TLD per RFC 6761 — guaranteed not to resolve, on any runtime.
const DEAD_HOST = "http://does-not-exist.invalid";

test("NetworkError basics", () => {
	const e = new HTTP_ERROR.NetworkError("boom");
	assert.ok(e instanceof HTTP_ERROR.NetworkError);
	assert.ok(e instanceof HTTP_ERROR.HttpError);
	assert.ok(e.status === 0);
	assert.ok(e.statusText === "Network Error");
	assert.ok(e.toString() === "HttpNetworkError: boom");
});

test("fetchOrThrow surfaces the real reason on transport failure", async () => {
	try {
		await fetchOrThrow(DEAD_HOST, undefined, "Issuer");
		assert.ok(false); // must not be reached
	} catch (e) {
		assert.ok(e instanceof HTTP_ERROR.NetworkError);
		// also catchable as the base HttpError
		assert.ok(e instanceof HTTP_ERROR.HttpError);
		// message carries the label and the target url
		assert.ok(e.message.includes("Issuer unreachable"));
		assert.ok(e.message.includes("does-not-exist.invalid"));
		// the underlying transport error is preserved as cause
		assert.ok(e.cause);
		// the real reason is surfaced, not the opaque "fetch failed"
		const reason = getErrorMessage(e);
		assert.ok(reason.length > 0);
		assert.ok(reason !== "fetch failed");
	}
});

test("fetchOrThrow uses a generic message when no label is given", async () => {
	try {
		await fetchOrThrow(DEAD_HOST);
		assert.ok(false); // must not be reached
	} catch (e) {
		assert.ok(e instanceof HTTP_ERROR.NetworkError);
		assert.ok(e.message.includes("Network request to"));
		assert.ok(e.message.includes("does-not-exist.invalid"));
	}
});

test("fetchOrThrow re-throws deliberate aborts untouched", async () => {
	const controller = new AbortController();
	controller.abort();
	try {
		await fetchOrThrow(DEAD_HOST, { signal: controller.signal });
		assert.ok(false); // must not be reached
	} catch (e) {
		// a deliberate cancellation must NOT be masked as a NetworkError
		assert.ok(!(e instanceof HTTP_ERROR.NetworkError));
		assert.ok((e as Error)?.name === "AbortError");
	}
});

test("fetchOrThrow accepts a URL instance and returns the Response on success", async () => {
	// data: URLs are fetchable across runtimes without a network round-trip.
	const r = await fetchOrThrow(new URL("data:text/plain,hello"));
	assert.ok(r instanceof Response);
	assert.ok((await r.text()) === "hello");
});

// --- observer hooks (onRequest / onError) ---

test("fetchOrThrow onRequest fires before a successful request", async () => {
	let calls = 0;
	let info: { url: string; method?: string; what?: string } | undefined;
	const r = await fetchOrThrow(new URL("data:text/plain,hello"), undefined, {
		onRequest: (i) => {
			calls++;
			info = i;
		},
	});
	assert.ok(r instanceof Response);
	assert.deepStrictEqual(calls, 1);
	assert.ok(info!.url.startsWith("data:text/plain"));
});

test("fetchOrThrow onRequest reports the method (from init and from Request)", async () => {
	let fromInit: string | undefined;
	await fetchOrThrow(DEAD_HOST, { method: "POST" }, {
		onRequest: (i) => (fromInit = i.method),
	}).catch(() => {}); // transport fails; we only assert onRequest ran first
	assert.deepStrictEqual(fromInit, "POST");

	let fromRequest: string | undefined;
	await fetchOrThrow(new Request(DEAD_HOST, { method: "PUT" }), undefined, {
		onRequest: (i) => (fromRequest = i.method),
	}).catch(() => {});
	assert.deepStrictEqual(fromRequest, "PUT");
});

test("fetchOrThrow onError fires with kind 'network' and still throws", async () => {
	let captured:
		| { error: unknown; url: string; what?: string; kind: string; reason: string }
		| undefined;
	try {
		await fetchOrThrow(DEAD_HOST, undefined, {
			what: "Issuer",
			onError: (i) => (captured = i),
		});
		assert.ok(false); // must not be reached
	} catch (e) {
		assert.ok(e instanceof HTTP_ERROR.NetworkError);
		assert.ok(captured);
		assert.deepStrictEqual(captured!.kind, "network");
		assert.deepStrictEqual(captured!.what, "Issuer");
		assert.ok(captured!.error instanceof HTTP_ERROR.NetworkError);
		assert.ok(captured!.error === e); // the very error that propagated
		assert.ok(captured!.url.includes("does-not-exist.invalid"));
		// the parsed reason is provided and matches what the error message embeds
		assert.ok(captured!.reason.length > 0);
		assert.ok(captured!.reason !== "fetch failed");
		assert.ok((e as Error).message.endsWith(captured!.reason));
	}
});

test("fetchOrThrow onError fires with kind 'abort' and preserves the original error", async () => {
	const controller = new AbortController();
	controller.abort();
	let captured: { error: unknown; kind: string; reason: string } | undefined;
	try {
		await fetchOrThrow(DEAD_HOST, { signal: controller.signal }, {
			onError: (i) => (captured = i),
		});
		assert.ok(false); // must not be reached
	} catch (e) {
		// abort must NOT be masked as a NetworkError
		assert.ok(!(e instanceof HTTP_ERROR.NetworkError));
		assert.deepStrictEqual((e as Error)?.name, "AbortError");
		assert.ok(captured);
		assert.deepStrictEqual(captured!.kind, "abort");
		assert.ok(captured!.error === e);
		// reason is still provided for non-network kinds (lazily from the error)
		assert.ok(captured!.reason.length > 0);
	}
});

test("fetchOrThrow swallows a throwing onError and propagates the real error", async () => {
	try {
		await fetchOrThrow(DEAD_HOST, undefined, {
			onError: () => {
				throw new Error("hook blew up");
			},
		});
		assert.ok(false); // must not be reached
	} catch (e) {
		// a broken hook must never replace the real NetworkError
		assert.ok(e instanceof HTTP_ERROR.NetworkError);
		assert.ok((e as Error).message !== "hook blew up");
	}
});

// --- observer hooks (onResponse) ---

test("fetchOrThrow onResponse fires after a successful request", async () => {
	let calls = 0;
	let info:
		| {
			url: string;
			method?: string;
			status: number;
			ok: boolean;
			durationMs: number;
		}
		| undefined;
	const r = await fetchOrThrow(new URL("data:text/plain,hello"), undefined, {
		onResponse: (i) => {
			calls++;
			info = i;
		},
	});
	assert.ok(r instanceof Response);
	// the body must still be readable — the hook must not consume it
	assert.deepStrictEqual(await r.text(), "hello");
	assert.deepStrictEqual(calls, 1);
	assert.deepStrictEqual(info!.status, 200);
	assert.deepStrictEqual(info!.ok, true);
	assert.ok(info!.url.startsWith("data:text/plain"));
	assert.ok(typeof info!.durationMs === "number" && info!.durationMs >= 0);
});

test("fetchOrThrow onResponse does NOT fire on a transport failure", async () => {
	let calls = 0;
	await fetchOrThrow(DEAD_HOST, undefined, {
		onResponse: () => calls++,
	}).catch(() => {});
	assert.deepStrictEqual(calls, 0);
});

test("fetchOrThrow onResponse fires for non-2xx responses too", async () => {
	const server = await serve(
		{ port: 0 },
		() => new Response("nope", { status: 503, statusText: "Service Unavailable" }),
	);
	const { port } = server;
	let info: { status: number; statusText: string; ok: boolean } | undefined;
	try {
		const r = await fetchOrThrow(`http://127.0.0.1:${port}/`, undefined, {
			onResponse: (i) => (info = i),
		});
		await r.body?.cancel(); // drain to let the server settle
		assert.deepStrictEqual(info!.status, 503);
		assert.deepStrictEqual(info!.statusText, "Service Unavailable");
		assert.deepStrictEqual(info!.ok, false);
	} finally {
		await server.shutdown();
	}
});

// --- global defaults (fetchOrThrow.global) ---

test("fetchOrThrow.global.onRequest applies as a default", async () => {
	let calls = 0;
	fetchOrThrow.global.onRequest = () => calls++;
	try {
		await fetchOrThrow(new URL("data:text/plain,hi"));
		assert.deepStrictEqual(calls, 1);
	} finally {
		fetchOrThrow.global.onRequest = undefined;
	}
});

test("fetchOrThrow per-call onRequest overrides the global default (not chained)", async () => {
	let globalCalls = 0;
	let perCallCalls = 0;
	fetchOrThrow.global.onRequest = () => globalCalls++;
	try {
		await fetchOrThrow(new URL("data:text/plain,hi"), undefined, {
			onRequest: () => perCallCalls++,
		});
		assert.deepStrictEqual(perCallCalls, 1);
		assert.deepStrictEqual(globalCalls, 0); // override, not chain
	} finally {
		fetchOrThrow.global.onRequest = undefined;
	}
});

test("fetchOrThrow.global.onResponse applies as a default", async () => {
	let calls = 0;
	let status = 0;
	fetchOrThrow.global.onResponse = (i) => {
		calls++;
		status = i.status;
	};
	try {
		await fetchOrThrow(new URL("data:text/plain,hi"));
		assert.deepStrictEqual(calls, 1);
		assert.deepStrictEqual(status, 200);
	} finally {
		fetchOrThrow.global.onResponse = undefined;
	}
});
