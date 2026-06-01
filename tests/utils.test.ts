import { assert } from "@std/assert";
import { HTTP_STATUS } from "../src/status.ts";
import { createHttpError, getErrorMessage, HTTP_ERROR } from "../src/error.ts";

Deno.test("HTTP_STATUS.findByCode", () => {
	const s = HTTP_STATUS.findByCode(200);
	assert(s !== null);
	assert(s.CODE === 200);
	assert(s.TEXT === "OK");
	assert(s._TYPE === "SUCCESS");
	assert(s._KEY === "OK");
});

Deno.test("HTTP_ERROR", () => {
	let e = new HTTP_ERROR.HttpError();
	assert(e.toString() === "HttpError");
	assert(e.status === HTTP_STATUS.ERROR_SERVER.INTERNAL_SERVER_ERROR.CODE);

	// random client pick
	e = new HTTP_ERROR.Unauthorized("Foo");
	assert(e.toString() === "HttpUnauthorizedError: Foo");
	assert(e.status === HTTP_STATUS.ERROR_CLIENT.UNAUTHORIZED.CODE);
	assert(e.statusText === HTTP_STATUS.ERROR_CLIENT.UNAUTHORIZED.TEXT);

	// random server pick
	e = new HTTP_ERROR.BadGateway("Foo");
	assert(e.toString() === "HttpBadGatewayError: Foo");
	assert(e.status === HTTP_STATUS.ERROR_SERVER.BAD_GATEWAY.CODE);
	assert(e.statusText === HTTP_STATUS.ERROR_SERVER.BAD_GATEWAY.TEXT);
});

Deno.test("createHttpErrorByCode", () => {
	// well known
	let e = createHttpError(404, null, '{"foo":"bar"}', '{"baz":"bat"}');

	assert(e instanceof HTTP_ERROR.NotFound);
	assert(e.toString() === "HttpNotFoundError: Not Found");
	assert((e.body as Record<string, unknown>).foo === "bar");
	assert((e.cause as Record<string, unknown>).baz === "bat");

	// NOT well known
	e = createHttpError(423, null, "{invalid json}", "{invalid json2}");
	assert(e instanceof HTTP_ERROR.HttpError);
	assert(e.toString() === "HttpError: Locked");
	assert(e.body === "{invalid json}");
	assert(e.cause === "{invalid json2}");

	// unknown code must fall back to 500
	e = createHttpError(123, null, "123", "456");
	assert(e instanceof HTTP_ERROR.InternalServerError);
	assert(e.toString() === "HttpInternalServerError: Internal Server Error");
	assert(e.body === 123); // '123' is a valid json string
	assert(e.cause === 456); // '123' is a valid json string

	// custom message
	e = createHttpError(123, "Hey", "123");
	assert(e.toString() === "HttpInternalServerError: Hey");
	assert(e.body === 123);
});

Deno.test("getErrorMessage", () => {
	let e = new TypeError("Foo");
	assert(getErrorMessage(e) === "Foo");
	assert(getErrorMessage(e, false) === "Foo");
	assert(getErrorMessage(e.toString()) === "Foo");
	assert(getErrorMessage(e.toString(), false) === "TypeError: Foo");

	assert(getErrorMessage({ toString: () => "custom" }) === "custom");
	assert(getErrorMessage({ toString: () => "" }) === "Unknown Error");
	assert(getErrorMessage(null) === "");

	e = createHttpError(123, "Hey", "123");
	assert(getErrorMessage(e) === "Hey");

	// body.error.message has priority over message
	e = createHttpError(123, "Hey", { error: { message: "Ho" } });
	assert(getErrorMessage(e) === "Ho");

	// body.message has priority over message
	e = createHttpError(123, "Hey", { message: "Ha" });
	assert(getErrorMessage(e) === "Ha");

	// cause.message has priority over cause.code
	e = createHttpError(
		123,
		"Hey",
		{ message: "Ha" },
		{ message: "YO", code: "Ignored" },
	);
	assert(getErrorMessage(e) === "YO");

	// cause.message has priority over body.message
	e = createHttpError(123, "Hey", { message: "Ha" }, { message: "Boom" });
	assert(getErrorMessage(e) === "Boom");

	// string cause still works
	e = createHttpError(123, "Hey", { message: "Ha" }, "because");
	assert(getErrorMessage(e) === "because");

	// string body still works
	e = createHttpError(123, "Hey", "because body says");
	assert(getErrorMessage(e) === "because body says");
});

Deno.test("getErrorMessage - well-known API conventions", () => {
	// OAuth 2 (RFC 6749): error_description preferred over error code
	let e = createHttpError(400, null, {
		error: "invalid_grant",
		error_description: "Token expired",
	});
	assert(getErrorMessage(e) === "Token expired");

	// RFC 7807 Problem Details / DRF / FastAPI
	e = createHttpError(422, null, { detail: "validation failed" });
	assert(getErrorMessage(e) === "validation failed");

	// RFC 7807 title fallback when no detail
	e = createHttpError(422, null, { title: "Unprocessable" });
	assert(getErrorMessage(e) === "Unprocessable");

	// JSON:API errors[] with detail
	e = createHttpError(400, null, { errors: [{ detail: "field x required" }] });
	assert(getErrorMessage(e) === "field x required");

	// JSON:API errors[] with title only
	e = createHttpError(400, null, { errors: [{ title: "Bad Field" }] });
	assert(getErrorMessage(e) === "Bad Field");

	// JSON:API errors[] with message
	e = createHttpError(400, null, { errors: [{ message: "msg from arr" }] });
	assert(getErrorMessage(e) === "msg from arr");

	// Plain string errors[]
	e = createHttpError(400, null, { errors: ["plain string"] });
	assert(getErrorMessage(e) === "plain string");

	// Nested OAuth under body.error
	e = createHttpError(400, null, {
		error: { error_description: "nested oauth msg" },
	});
	assert(getErrorMessage(e) === "nested oauth msg");

	// Nested RFC 7807 detail under body.error
	e = createHttpError(400, null, { error: { detail: "nested detail" } });
	assert(getErrorMessage(e) === "nested detail");

	// Cause-tier mirror: RFC 7807 detail in cause
	e = createHttpError(500, "msg", null, { detail: "deep reason" });
	assert(getErrorMessage(e) === "deep reason");

	// Cause-tier mirror: OAuth 2 error_description in cause
	e = createHttpError(500, "msg", null, {
		error: "x",
		error_description: "deep oauth",
	});
	assert(getErrorMessage(e) === "deep oauth");

	// Node.js error code fallback (no message)
	const nodeErr = Object.assign(new Error(), { code: "ECONNREFUSED" });
	assert(getErrorMessage(nodeErr) === "ECONNREFUSED");

	// err.message still wins over err.code when present
	const nodeErr2 = Object.assign(new Error("connect failed"), {
		code: "ECONNREFUSED",
	});
	assert(getErrorMessage(nodeErr2) === "connect failed");

	// existing body.error.message still wins over new paths (BC check)
	e = createHttpError(400, null, {
		error: { message: "primary", error_description: "secondary" },
		detail: "tertiary",
	});
	assert(getErrorMessage(e) === "primary");
});
