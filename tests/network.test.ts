import { assert } from "@std/assert";
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
