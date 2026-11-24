import assert from "node:assert/strict";
import { afterEach, test } from "node:test";
import {
	createHttpApi,
	createHttpError,
	getBodyMessage,
	getErrorMessage,
	HTTP_ERROR,
	type HttpErrorLike,
	PROBLEM_MEDIA_TYPE,
	type ProblemDetails,
	problemOf,
} from "../src/mod.ts";

type HttpError = InstanceType<typeof HTTP_ERROR.HttpError>;

const CONFLICT = {
	type: "urn:example:error:conflict",
	title: "Conflict",
	status: 412,
	detail: "order 1 is at version 4, not 3.",
	instance: "/api/order/1",
};

const VALIDATION = {
	type: "urn:example:error:validation",
	title: "Validation failed",
	status: 400,
	detail: "The value does not match the schema.",
	errors: [{ path: "ref", message: "is required", keyword: "required" }],
};

const HTML =
	"<html><head><title>502 Bad Gateway</title></head>" +
	"<body><center><h1>502 Bad Gateway</h1></center></body></html>";

/** A problem document as a server sends it. */
function problemResponse(
	document: Record<string, unknown>,
	init: { status?: number; statusText?: string; type?: string } = {},
): Response {
	return new Response(JSON.stringify(document), {
		status: init.status ?? (document.status as number),
		statusText: init.statusText ?? "",
		headers: { "content-type": init.type ?? PROBLEM_MEDIA_TYPE },
	});
}

const realFetch = globalThis.fetch;
afterEach(() => {
	globalThis.fetch = realFetch;
	createHttpApi.defaultErrorMessageExtractor = null;
	createHttpApi.global.appendUrlToErrorMessage = false;
});

/**
 * The error an `HttpApi` call throws for `make()`'s response. `fetch` is replaced for
 * the call, so the response is exactly the one given: an empty `statusText` stays
 * empty, the way HTTP/2 delivers every response (a `node:http` server always sends a
 * reason phrase).
 */
async function thrownFor(make: () => Response): Promise<HttpError> {
	globalThis.fetch = (async () => make()) as typeof fetch;
	try {
		await createHttpApi("https://api.example.com").get("/order/1", {
			query: { expand: "items" },
		});
	} catch (e) {
		return e as HttpError;
	}
	throw new Error("expected the call to throw");
}

// --- getBodyMessage ---

test("getBodyMessage: reads the conventions it documents, in order", () => {
	assert.equal(getBodyMessage({ error: { message: "a" }, message: "b" }), "a");
	assert.equal(getBodyMessage({ message: "b", detail: "c" }), "b");
	assert.equal(getBodyMessage({ error: { error_description: "d" } }), "d");
	assert.equal(getBodyMessage({ error: { detail: "e" } }), "e");
	assert.equal(getBodyMessage({ detail: "f", title: "g" }), "f");
	assert.equal(getBodyMessage({ title: "g" }), "g");
	assert.equal(getBodyMessage({ error: "code", error_description: "h" }), "h");
	assert.equal(getBodyMessage({ errors: ["i"] }), "i");
	assert.equal(getBodyMessage({ errors: [{ title: "j", message: "k" }] }), "j");
	assert.equal(getBodyMessage({ error: "invalid_grant" }), "invalid_grant");
	assert.equal(getBodyMessage("plain text\n"), "plain text");
	// JSON text is parsed first
	assert.equal(getBodyMessage('{"message":"from json"}'), "from json");
});

test("getBodyMessage: a problem document says it in detail, whatever else it carries", () => {
	assert.equal(getBodyMessage(CONFLICT), CONFLICT.detail);
	assert.equal(getBodyMessage(VALIDATION), VALIDATION.detail);
	// an extension member named like another convention does not outrank `detail`
	assert.equal(
		getBodyMessage({ ...CONFLICT, message: "extension", error: "extension" }),
		CONFLICT.detail,
	);
	// no detail: the generic reading takes over, and ends at the title
	const { detail: _, ...bare } = CONFLICT;
	assert.equal(getBodyMessage(bare), "Conflict");
});

test("getBodyMessage: nothing to say is null", () => {
	assert.equal(getBodyMessage(null), null);
	assert.equal(getBodyMessage(undefined), null);
	assert.equal(getBodyMessage(""), null);
	assert.equal(getBodyMessage("   "), null);
	assert.equal(getBodyMessage({}), null);
	assert.equal(getBodyMessage({ foo: "bar" }), null);
	assert.equal(getBodyMessage([1, 2]), null);
	assert.equal(getBodyMessage(42), null);
	assert.equal(getBodyMessage({ message: "  " }), null);
});

test("getBodyMessage: only a string (or a number) is a message", () => {
	// FastAPI's validation `detail` is an array
	assert.equal(
		getBodyMessage({ detail: [{ loc: ["body", "x"], msg: "required" }] }),
		null,
	);
	assert.equal(getBodyMessage({ error: { code: "E_X" } }), null);
	assert.equal(getBodyMessage({ message: { en: "Hi" } }), null);
	assert.equal(getBodyMessage({ error: true }), null);
	// ...and the next convention still answers
	assert.equal(
		getBodyMessage({ message: { en: "Hi" }, title: "Bad input" }),
		"Bad input",
	);
	assert.equal(getBodyMessage({ error: 1040 }), "1040");
});

test("getBodyMessage: markup is not a message, long text is cut", () => {
	assert.equal(getBodyMessage(HTML), null);
	assert.equal(getBodyMessage("  <!DOCTYPE html><html></html>"), null);
	assert.equal(getBodyMessage('<?xml version="1.0"?><Error/>'), null);

	const long = "x".repeat(600);
	const cut = getBodyMessage(long);
	assert.equal(cut, `${"x".repeat(500)}…`);
	// a sentence a producer chose is never cut
	assert.equal(getBodyMessage({ detail: long }), long);
});

// --- problemOf ---

test("problemOf: a problem document is itself, extension members included", () => {
	const problem = problemOf(VALIDATION, {
		status: 400,
		mediaType: PROBLEM_MEDIA_TYPE,
	});
	assert.deepEqual(problem, VALIDATION);
});

test("problemOf: takes a Response, and the body as text", async () => {
	const response = problemResponse(CONFLICT, {
		type: "application/problem+json; charset=utf-8",
	});
	assert.deepEqual(problemOf(await response.text(), response), CONFLICT);
});

test("problemOf: a type and a title make a problem under any media type", () => {
	assert.deepEqual(
		problemOf(CONFLICT, { status: 412, mediaType: "application/json" }),
		CONFLICT,
	);
	assert.deepEqual(problemOf(CONFLICT, { status: 412 }), CONFLICT);
});

test("problemOf: absent members are completed the way RFC 9457 reads an absence", () => {
	const problem = problemOf(
		{ detail: 42, instance: 7, extra: "kept" },
		{ status: 403, statusText: "Forbidden", mediaType: PROBLEM_MEDIA_TYPE },
	);
	// `detail` and `instance` of the wrong type are dropped
	assert.deepEqual(problem, {
		type: "about:blank",
		title: "Forbidden",
		status: 403,
		extra: "kept",
	});

	// the document's own status and title win over the response's
	assert.deepEqual(
		problemOf(
			{ title: "Out of credit", status: 402 },
			{ status: 400, mediaType: PROBLEM_MEDIA_TYPE },
		),
		{ type: "about:blank", title: "Out of credit", status: 402 },
	);
});

test("problemOf: any other body is about:blank, with its sentence as the detail", () => {
	assert.deepEqual(
		problemOf("Invalid token.", { status: 401, statusText: "Unauthorized" }),
		{
			type: "about:blank",
			title: "Unauthorized",
			status: 401,
			detail: "Invalid token.",
		},
	);
	assert.deepEqual(problemOf({ error: "Invalid code." }, { status: 400 }), {
		type: "about:blank",
		title: "Bad Request",
		status: 400,
		detail: "Invalid code.",
	});
	// without the media type, a title alone is just a sentence
	assert.deepEqual(problemOf({ title: "Out of credit" }, { status: 402 }), {
		type: "about:blank",
		title: "Payment Required",
		status: 402,
		detail: "Out of credit",
	});
	assert.equal(problemOf(null, { status: 425 }).title, "Too Early");
});

test("problemOf: a page of markup or no body leaves the status as the whole story", () => {
	assert.deepEqual(problemOf(HTML, { status: 502, mediaType: "text/html" }), {
		type: "about:blank",
		title: "Bad Gateway",
		status: 502,
	});
	assert.deepEqual(problemOf(null, { status: 500, statusText: "" }), {
		type: "about:blank",
		title: "Internal Server Error",
		status: 500,
	});
	// a status with no standard phrase
	assert.equal(problemOf(null, { status: 599 }).title, "HTTP 599");
	// the server's own reason phrase wins over the standard one
	assert.equal(
		problemOf(null, { status: 404, statusText: "No Such Order" }).title,
		"No Such Order",
	);
});

// --- HttpError.problem / .type ---

test("HttpError: problem and type are read from the body", () => {
	const e = createHttpError(409, null, { ...CONFLICT, status: 409 });
	assert.deepEqual(e.problem, { ...CONFLICT, status: 409 });
	assert.equal(e.type, CONFLICT.type);

	// not a problem document: about:blank, never undefined
	const plain = new HTTP_ERROR.NotFound("Article not found");
	assert.deepEqual(plain.problem, {
		type: "about:blank",
		title: "Not Found",
		status: 404,
	});
	assert.equal(plain.type, "about:blank");

	const network = new HTTP_ERROR.NetworkError("unreachable");
	assert.deepEqual(network.problem, {
		type: "about:blank",
		title: "Network Error",
		status: 0,
	});
});

test("HttpError: the getters stay off the serialized error", () => {
	const e = createHttpError(409, null, CONFLICT);
	assert.deepEqual(Object.keys(e).sort(), ["body", "name", "status", "statusText"]);
	assert.equal(e.method, undefined);
	assert.equal(e.url, undefined);
});

// --- the HttpApi client ---

test("HttpApi: a problem document becomes the message, the type and the request context", async () => {
	const e = await thrownFor(() => problemResponse(CONFLICT));

	assert.equal(e.status, 412);
	assert.equal(e.message, CONFLICT.detail);
	assert.equal(getErrorMessage(e), CONFLICT.detail);
	assert.equal(e.type, CONFLICT.type);
	assert.deepEqual(e.problem, CONFLICT);
	assert.deepEqual(e.body, CONFLICT);
	assert.equal(e.method, "GET");
	assert.equal(e.url, "https://api.example.com/order/1?expand=items");
});

test("HttpApi: a problem without a detail answers with its title", async () => {
	const { detail: _, ...bare } = CONFLICT;
	const e = await thrownFor(() => problemResponse(bare));
	assert.equal(e.message, "Conflict");
	assert.equal(getErrorMessage(e), "Conflict");
});

test("HttpApi: the media type makes a problem of a document that names no type", async () => {
	const e = await thrownFor(() =>
		problemResponse({ title: "Out of credit", balance: 30 }, { status: 402 }),
	);
	assert.deepEqual(e.problem, {
		type: "about:blank",
		title: "Out of credit",
		status: 402,
		balance: 30,
	});
	assert.equal(e.message, "Out of credit");
});

test("HttpApi: a validation problem keeps its errors, and the sentence is still the detail", async () => {
	const e = await thrownFor(() => problemResponse(VALIDATION));
	assert.ok(e instanceof HTTP_ERROR.BadRequest);
	assert.equal(e.message, VALIDATION.detail);
	assert.deepEqual(e.problem.errors, VALIDATION.errors);
});

test("HttpApi: a plain-text error body is the message", async () => {
	const e = await thrownFor(() => new Response("Email is required", { status: 400 }));
	assert.equal(e.message, "Email is required");
	assert.equal(getErrorMessage(e), "Email is required");
	assert.deepEqual(e.problem, {
		type: "about:blank",
		title: "Bad Request",
		status: 400,
		detail: "Email is required",
	});
});

test("HttpApi: with nothing said, the status speaks (also when the phrase is empty)", async () => {
	// HTTP/2 has no reason phrase, so `statusText` is "" there
	const empty = await thrownFor(
		() => new Response(null, { status: 409, statusText: "" }),
	);
	assert.equal(empty.message, "Conflict");

	const unreadable = await thrownFor(
		() =>
			new Response(JSON.stringify({ foo: "bar" }), { status: 422, statusText: "" }),
	);
	assert.equal(unreadable.message, "Unprocessable Content");

	// the server's own phrase, when it sent one
	const custom = await thrownFor(
		() => new Response(null, { status: 404, statusText: "No Such Order" }),
	);
	assert.equal(custom.message, "No Such Order");

	// a status without a standard phrase
	const odd = await thrownFor(
		() => new Response(null, { status: 599, statusText: "" }),
	);
	assert.equal(odd.message, "HTTP 599");
});

test("HttpApi: an HTML error page is never the message", async () => {
	const e = await thrownFor(
		() =>
			new Response(HTML, { status: 502, headers: { "content-type": "text/html" } }),
	);
	assert.equal(e.message, "Bad Gateway");
	assert.equal(getErrorMessage(e), "Bad Gateway");
	assert.equal(e.body, HTML);
	assert.equal(e.type, "about:blank");
});

test("HttpApi: a member that is not a sentence is skipped", async () => {
	const e = await thrownFor(
		() => new Response(JSON.stringify({ error: { code: "E_X" } }), { status: 400 }),
	);
	assert.equal(e.message, "Bad Request");
	assert.equal(getErrorMessage(e), "Bad Request");
});

test("HttpApi: an extractor that says nothing falls back to the status", async () => {
	createHttpApi.defaultErrorMessageExtractor = () => "";
	const e = await thrownFor(() => problemResponse(CONFLICT));
	assert.equal(e.message, "Precondition Failed");
});

test("HttpApi: an extractor can decorate the built-in reading", async () => {
	createHttpApi.defaultErrorMessageExtractor = (body, response) =>
		`[${response.status}] ${getBodyMessage(body) ?? "no message"}`;
	const e = await thrownFor(() => problemResponse(CONFLICT));
	assert.equal(e.message, `[412] ${CONFLICT.detail}`);
	// the URL decoration is applied to whatever was extracted
	createHttpApi.global.appendUrlToErrorMessage = true;
	const decorated = await thrownFor(() => problemResponse(CONFLICT));
	assert.equal(
		decorated.message,
		`[412] ${CONFLICT.detail} (GET https://api.example.com/order/1?expand=items)`,
	);
	// ...and `getErrorMessage` still answers what the server said
	assert.equal(getErrorMessage(decorated), CONFLICT.detail);
});

// --- getErrorMessage ---

test("getErrorMessage: a typed problem speaks for itself, over its cause", () => {
	const driver = Object.assign(
		new Error('duplicate key value violates unique constraint "order_ref_key"'),
		{ code: "23505" },
	);

	// an error that carries its refusal as `problem`, and what lies underneath as `cause`
	class Refusal extends Error {
		readonly problem: ProblemDetails;
		constructor(problem: ProblemDetails, options?: ErrorOptions) {
			super(problem.detail ?? problem.title, options);
			this.problem = problem;
		}
	}

	const internal = new Refusal(
		{ type: "urn:example:error:internal", title: "Internal error", status: 500 },
		{ cause: driver },
	);
	assert.equal(getErrorMessage(internal), "Internal error");

	const duplicate = new Refusal(
		{
			type: "urn:example:error:duplicate",
			title: "Duplicate value",
			status: 409,
			detail: "ref must be unique.",
		},
		{ cause: driver },
	);
	assert.equal(getErrorMessage(duplicate), "ref must be unique.");

	// the same holds for this package's own error
	const own = createHttpError(409, null, { ...CONFLICT, status: 409 }, driver);
	assert.equal(getErrorMessage(own), CONFLICT.detail);
});

test("getErrorMessage: about:blank is no statement, so the usual order applies", () => {
	// a wrapper whose message is only the status phrase: what it wraps answers
	const wrapper = createHttpError(400, null, null, new Error("Email is required"));
	assert.equal(wrapper.type, "about:blank");
	assert.equal(getErrorMessage(wrapper), "Email is required");

	// cause.message keeps its priority over body.message
	const both = createHttpError(400, "Hey", { message: "Ha" }, { message: "Boom" });
	assert.equal(getErrorMessage(both), "Boom");
});

test("getErrorMessage: an error class of another package reads like an HttpError", () => {
	// Not an HttpError: one class for every non-2xx answer, keyed by the problem type,
	// carrying the members `HttpErrorLike` names.
	class ApiError extends Error {
		readonly problem: ProblemDetails;
		readonly status: number;
		readonly body: unknown;
		readonly method = "PATCH";
		readonly url = "/api/order/1";
		constructor(body: unknown, source: { status: number; mediaType?: string }) {
			const problem = problemOf(body, source);
			super(problem.detail ?? problem.title);
			this.problem = problem;
			this.status = source.status;
			this.body = body;
		}
	}
	const typed = new ApiError(CONFLICT, { status: 412, mediaType: PROBLEM_MEDIA_TYPE });
	const like: HttpErrorLike = typed;
	assert.equal(getErrorMessage(like), CONFLICT.detail);

	const text = new ApiError("Invalid token.", { status: 401, mediaType: "text/plain" });
	assert.equal(getErrorMessage(text), "Invalid token.");

	const json = new ApiError({ error: "Invalid code." }, { status: 400 });
	assert.equal(getErrorMessage(json), "Invalid code.");

	// a proxy's HTML page: the error's own message, never the page
	const page = new ApiError(HTML, { status: 502, mediaType: "text/html" });
	assert.equal(page.message, "Bad Gateway");
	assert.equal(getErrorMessage(page), "Bad Gateway");

	// this package's own error has the same shape
	const own: HttpErrorLike = createHttpError(404);
	assert.equal(own.status, 404);
});

test("getErrorMessage: never renders an object as a message", () => {
	assert.equal(
		getErrorMessage({ body: { detail: [{ msg: "required" }] }, message: "fallback" }),
		"fallback",
	);
	assert.equal(
		getErrorMessage({ body: { error: { code: "E_X" } }, message: "fallback" }),
		"fallback",
	);
	assert.equal(
		getErrorMessage({ cause: { message: { en: "Hi" } }, message: "fallback" }),
		"fallback",
	);
	assert.equal(getErrorMessage({ foo: "bar" }), "Unknown Error");
	assert.equal(getErrorMessage({ body: HTML }), "Unknown Error");
	assert.equal(getErrorMessage(new Response(null, { status: 500 })), "Unknown Error");
	// numeric codes still count
	assert.equal(getErrorMessage({ cause: { code: 1040 } }), "1040");
});

// --- identity across installed copies ---

type ErrorModule = typeof import("../src/error.ts");
type ApiModule = typeof import("../src/api.ts");

/**
 * A second, independent instance of the two modules that hold per-copy state (the
 * error classes, the client), as a second installed copy of the package has them. A
 * query string is a different module to the loader (see `second-copy.d.ts`). The
 * specifiers are literals so that Deno loads them with the test's own module graph.
 */
async function secondCopy(): Promise<
	Pick<ErrorModule, "HTTP_ERROR" | "createHttpError"> & Pick<ApiModule, "createHttpApi">
> {
	// `as unknown as`: to a checker that resolves the query string (Deno's) these are
	// distinct modules with distinct classes, which is the very thing under test.
	const errors = (await import("../src/error.ts?copy=2")) as unknown as ErrorModule;
	const client = (await import("../src/api.ts?copy=2")) as unknown as ApiModule;
	return {
		HTTP_ERROR: errors.HTTP_ERROR,
		createHttpError: errors.createHttpError,
		createHttpApi: client.createHttpApi,
	};
}

test("instanceof holds across copies of the package", async () => {
	const other = await secondCopy();
	assert.notEqual(other.HTTP_ERROR.NotFound, HTTP_ERROR.NotFound);

	const theirs = new other.HTTP_ERROR.NotFound("gone");
	assert.ok(theirs instanceof HTTP_ERROR.NotFound);
	assert.ok(theirs instanceof HTTP_ERROR.HttpError);
	assert.ok(!(theirs instanceof HTTP_ERROR.Forbidden));
	assert.ok(!(theirs instanceof HTTP_ERROR.NetworkError));

	// ...and the other way around
	const ours = new HTTP_ERROR.Unauthorized();
	assert.ok(ours instanceof other.HTTP_ERROR.Unauthorized);
	assert.ok(ours instanceof other.HTTP_ERROR.HttpError);
	assert.ok(!(ours instanceof other.HTTP_ERROR.NotFound));

	// what `createHttpError` returns, including a status with no class of its own
	assert.ok(other.createHttpError(503) instanceof HTTP_ERROR.ServiceUnavailable);
	const locked = other.createHttpError(423);
	assert.ok(locked instanceof HTTP_ERROR.HttpError);
	assert.ok(!(locked instanceof HTTP_ERROR.InternalServerError));

	// HttpError (500 by default) and InternalServerError stay distinct
	assert.ok(
		!(new other.HTTP_ERROR.HttpError() instanceof HTTP_ERROR.InternalServerError),
	);
	assert.ok(new other.HTTP_ERROR.InternalServerError() instanceof HTTP_ERROR.HttpError);
});

test("instanceof: subclasses and strangers", async () => {
	const other = await secondCopy();

	// a subclass made from another copy's class is still that class here
	class TheirTeapot extends other.HTTP_ERROR.ImATeapot {}
	assert.ok(new TheirTeapot() instanceof HTTP_ERROR.ImATeapot);
	assert.ok(new TheirTeapot() instanceof HTTP_ERROR.HttpError);

	// a subclass of your own is not registered: plain instanceof semantics
	class MyNotFound extends HTTP_ERROR.NotFound {}
	assert.ok(new MyNotFound() instanceof MyNotFound);
	assert.ok(new MyNotFound() instanceof HTTP_ERROR.NotFound);
	assert.ok(!(new HTTP_ERROR.NotFound() instanceof MyNotFound));
	assert.ok(!(new other.HTTP_ERROR.NotFound() instanceof MyNotFound));

	// nothing else is an HttpError
	for (const stranger of [
		null,
		undefined,
		"NotFound",
		404,
		{},
		new Error("x"),
		Object.assign(new Error("x"), {
			name: "HttpNotFoundError",
			status: 404,
			body: null,
		}),
		Object.create(null),
	]) {
		assert.ok(!(stranger instanceof HTTP_ERROR.HttpError));
		assert.ok(!(stranger instanceof HTTP_ERROR.NotFound));
	}
});

test("createHttpApi.defaultErrorMessageExtractor is shared across copies", async () => {
	const other = await secondCopy();
	const extractor = () => "SHARED";

	createHttpApi.defaultErrorMessageExtractor = extractor;
	assert.equal(other.createHttpApi.defaultErrorMessageExtractor, extractor);

	other.createHttpApi.defaultErrorMessageExtractor = null;
	assert.equal(createHttpApi.defaultErrorMessageExtractor, null);

	// and it is what a request of either copy runs
	createHttpApi.defaultErrorMessageExtractor = extractor;
	globalThis.fetch = (async () => problemResponse(CONFLICT)) as typeof fetch;
	await assert.rejects(other.createHttpApi("https://api.example.com").get("/x"), {
		message: "SHARED",
	});
});
