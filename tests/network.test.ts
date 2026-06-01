import { assert, assertEquals } from "@std/assert";
import { fetchOrThrow } from "../src/mod.ts";
import { getErrorMessage, HTTP_ERROR } from "../src/error.ts";

// Reserved TLD per RFC 6761 — guaranteed not to resolve, on any runtime.
const DEAD_HOST = "http://does-not-exist.invalid";

Deno.test("NetworkError basics", () => {
	const e = new HTTP_ERROR.NetworkError("boom");
	assert(e instanceof HTTP_ERROR.NetworkError);
	assert(e instanceof HTTP_ERROR.HttpError);
	assert(e.status === 0);
	assert(e.statusText === "Network Error");
	assert(e.toString() === "HttpNetworkError: boom");
});

Deno.test("fetchOrThrow surfaces the real reason on transport failure", async () => {
	try {
		await fetchOrThrow(DEAD_HOST, undefined, "Issuer");
		assert(false); // must not be reached
	} catch (e) {
		assert(e instanceof HTTP_ERROR.NetworkError);
		// also catchable as the base HttpError
		assert(e instanceof HTTP_ERROR.HttpError);
		// message carries the label and the target url
		assert(e.message.includes("Issuer unreachable"));
		assert(e.message.includes("does-not-exist.invalid"));
		// the underlying transport error is preserved as cause
		assert(e.cause);
		// the real reason is surfaced, not the opaque "fetch failed"
		const reason = getErrorMessage(e);
		assert(reason.length > 0);
		assert(reason !== "fetch failed");
	}
});

Deno.test("fetchOrThrow uses a generic message when no label is given", async () => {
	try {
		await fetchOrThrow(DEAD_HOST);
		assert(false); // must not be reached
	} catch (e) {
		assert(e instanceof HTTP_ERROR.NetworkError);
		assert(e.message.includes("Network request to"));
		assert(e.message.includes("does-not-exist.invalid"));
	}
});

Deno.test("fetchOrThrow re-throws deliberate aborts untouched", async () => {
	const controller = new AbortController();
	controller.abort();
	try {
		await fetchOrThrow(DEAD_HOST, { signal: controller.signal });
		assert(false); // must not be reached
	} catch (e) {
		// a deliberate cancellation must NOT be masked as a NetworkError
		assert(!(e instanceof HTTP_ERROR.NetworkError));
		assert((e as Error)?.name === "AbortError");
	}
});

Deno.test("fetchOrThrow accepts a URL instance and returns the Response on success", async () => {
	// data: URLs are fetchable across runtimes without a network round-trip.
	const r = await fetchOrThrow(new URL("data:text/plain,hello"));
	assert(r instanceof Response);
	assert((await r.text()) === "hello");
});

// --- observer hooks (onRequest / onError) ---

Deno.test("fetchOrThrow onRequest fires before a successful request", async () => {
	let calls = 0;
	let info: { url: string; method?: string; what?: string } | undefined;
	const r = await fetchOrThrow(new URL("data:text/plain,hello"), undefined, {
		onRequest: (i) => {
			calls++;
			info = i;
		},
	});
	assert(r instanceof Response);
	assertEquals(calls, 1);
	assert(info!.url.startsWith("data:text/plain"));
});

Deno.test("fetchOrThrow onRequest reports the method (from init and from Request)", async () => {
	let fromInit: string | undefined;
	await fetchOrThrow(DEAD_HOST, { method: "POST" }, {
		onRequest: (i) => (fromInit = i.method),
	}).catch(() => {}); // transport fails; we only assert onRequest ran first
	assertEquals(fromInit, "POST");

	let fromRequest: string | undefined;
	await fetchOrThrow(new Request(DEAD_HOST, { method: "PUT" }), undefined, {
		onRequest: (i) => (fromRequest = i.method),
	}).catch(() => {});
	assertEquals(fromRequest, "PUT");
});

Deno.test("fetchOrThrow onError fires with kind 'network' and still throws", async () => {
	let captured:
		| { error: unknown; url: string; what?: string; kind: string; reason: string }
		| undefined;
	try {
		await fetchOrThrow(DEAD_HOST, undefined, {
			what: "Issuer",
			onError: (i) => (captured = i),
		});
		assert(false); // must not be reached
	} catch (e) {
		assert(e instanceof HTTP_ERROR.NetworkError);
		assert(captured);
		assertEquals(captured!.kind, "network");
		assertEquals(captured!.what, "Issuer");
		assert(captured!.error instanceof HTTP_ERROR.NetworkError);
		assert(captured!.error === e); // the very error that propagated
		assert(captured!.url.includes("does-not-exist.invalid"));
		// the parsed reason is provided and matches what the error message embeds
		assert(captured!.reason.length > 0);
		assert(captured!.reason !== "fetch failed");
		assert((e as Error).message.endsWith(captured!.reason));
	}
});

Deno.test("fetchOrThrow onError fires with kind 'abort' and preserves the original error", async () => {
	const controller = new AbortController();
	controller.abort();
	let captured: { error: unknown; kind: string; reason: string } | undefined;
	try {
		await fetchOrThrow(DEAD_HOST, { signal: controller.signal }, {
			onError: (i) => (captured = i),
		});
		assert(false); // must not be reached
	} catch (e) {
		// abort must NOT be masked as a NetworkError
		assert(!(e instanceof HTTP_ERROR.NetworkError));
		assertEquals((e as Error)?.name, "AbortError");
		assert(captured);
		assertEquals(captured!.kind, "abort");
		assert(captured!.error === e);
		// reason is still provided for non-network kinds (lazily from the error)
		assert(captured!.reason.length > 0);
	}
});

Deno.test("fetchOrThrow swallows a throwing onError and propagates the real error", async () => {
	try {
		await fetchOrThrow(DEAD_HOST, undefined, {
			onError: () => {
				throw new Error("hook blew up");
			},
		});
		assert(false); // must not be reached
	} catch (e) {
		// a broken hook must never replace the real NetworkError
		assert(e instanceof HTTP_ERROR.NetworkError);
		assert((e as Error).message !== "hook blew up");
	}
});

// --- global defaults (fetchOrThrow.global) ---

Deno.test("fetchOrThrow.global.onRequest applies as a default", async () => {
	let calls = 0;
	fetchOrThrow.global.onRequest = () => calls++;
	try {
		await fetchOrThrow(new URL("data:text/plain,hi"));
		assertEquals(calls, 1);
	} finally {
		fetchOrThrow.global.onRequest = undefined;
	}
});

Deno.test("fetchOrThrow per-call onRequest overrides the global default (not chained)", async () => {
	let globalCalls = 0;
	let perCallCalls = 0;
	fetchOrThrow.global.onRequest = () => globalCalls++;
	try {
		await fetchOrThrow(new URL("data:text/plain,hi"), undefined, {
			onRequest: () => perCallCalls++,
		});
		assertEquals(perCallCalls, 1);
		assertEquals(globalCalls, 0); // override, not chain
	} finally {
		fetchOrThrow.global.onRequest = undefined;
	}
});
