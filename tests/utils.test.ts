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
	assert(e.body.foo === "bar");
	assert((e.cause as any).baz === "bat");

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
		{ message: "YO", code: "Ignored" }
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
