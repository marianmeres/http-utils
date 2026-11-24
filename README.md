# @marianmeres/http-utils

[![NPM version](https://img.shields.io/npm/v/@marianmeres/http-utils)](https://www.npmjs.com/package/@marianmeres/http-utils)
[![JSR version](https://jsr.io/badges/@marianmeres/http-utils)](https://jsr.io/@marianmeres/http-utils)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

Opinionated, lightweight HTTP client wrapper for `fetch` with type-safe errors and
convenient defaults.

## Features

- 🎯 **Type-safe HTTP errors** - Well-known status codes map to specific error classes
- 🔧 **Convenient defaults** - Auto JSON parsing, Bearer tokens, base URLs
- 🪶 **Lightweight** - Zero dependencies, thin wrapper over native `fetch`
- 🎨 **Flexible error handling** - Three-tier error message extraction (local → factory →
  global)
- 📄 **Reads Problem Details** - an RFC 9457 response becomes the error's message and a
  stable `error.type` to branch on, with nothing to configure
- 🛰️ **No swallowed transport errors** - DNS/connection failures surface the host and real
  reason instead of an opaque "fetch failed"
- 📦 **Universal** - Web standards only: browsers, Node and any modern runtime
- 🦾 **Generic return types** - Optional type parameters for typed responses

## Installation

```shell
npm install @marianmeres/http-utils
```

```shell
deno add jsr:@marianmeres/http-utils
```

Plain ESM with type declarations, zero dependencies.

```ts
import { createHttpApi, HTTP_ERROR, opts } from "@marianmeres/http-utils";
```

## Quick Start

```ts
import { createHttpApi, HTTP_ERROR, opts } from "@marianmeres/http-utils";

// Create an API client with base URL
const api = createHttpApi("https://api.example.com", {
	headers: { "Authorization": "Bearer your-token" },
});

// GET request (options API with opts() wrapper)
const users = await api.get(
	"/users",
	opts({
		params: { headers: { "X-Custom": "value" } },
	}),
);

// POST request (options API with opts() wrapper)
const newUser = await api.post(
	"/users",
	opts({
		data: { name: "John Doe" },
		params: { headers: { "X-Custom": "value" } },
	}),
);

// Legacy API (default behavior without opts())
const legacyUsers = await api.get("/users", { headers: { "X-Custom": "value" } });
const legacyUser = await api.post("/users", { name: "John Doe" });

// With type parameters for typed responses
interface User {
	id: number;
	name: string;
}
const user = await api.get<User>("/users/1");
const created = await api.post<User>("/users", opts({ data: { name: "Jane" } }));

// Error handling
try {
	await api.get("/not-found");
} catch (error) {
	if (error instanceof HTTP_ERROR.NotFound) {
		console.log(error.status); // 404
		console.log(error.message); // what the server said
		console.log(error.body); // Response body
	}
}
```

## API Overview

### `createHttpApi(base?, defaults?, errorExtractor?)`

Creates an HTTP API client.

```ts
const api = createHttpApi("https://api.example.com", {
	headers: { "Authorization": "Bearer token" },
});
```

### HTTP Methods

```ts
// GET (options API with opts() wrapper)
const data = await api.get(
	"/users",
	opts({
		params: { headers: { "X-Custom": "value" } },
		respHeaders: {},
	}),
);

// POST/PUT/PATCH/DELETE (options API with opts() wrapper)
await api.post(
	"/users",
	opts({
		data: { name: "John" },
		params: { token: "bearer-token" },
	}),
);

// Legacy API (default behavior without opts())
const data = await api.get("/users", { headers: { "X-Custom": "value" } });
await api.post("/users", { name: "John" });
```

### The `opts()` Helper

The `opts()` function explicitly marks an options object for the options-based API.
Without it, arguments are treated as legacy positional parameters.

```ts
// Without opts() - legacy behavior: object is sent as request body
await api.post("/users", { data: { name: "John" } }); // Sends: { data: { name: "John" } }

// With opts() - options API: data is extracted and sent as body
await api.post("/users", opts({ data: { name: "John" } })); // Sends: { name: "John" }
```

This makes the API unambiguous and prevents accidental misinterpretation of request data.

### Error Handling

```ts
import { HTTP_ERROR } from "@marianmeres/http-utils";

try {
	await api.get("/resource");
} catch (error) {
	if (error instanceof HTTP_ERROR.NotFound) {
		console.log("Not found:", error.message, error.body);
	}
	// Transport-level failures (DNS, refused connection, unreachable host) throw
	// a NetworkError (status 0) instead of an opaque "fetch failed":
	if (error instanceof HTTP_ERROR.NetworkError) {
		console.log(error.message); // e.g. "GET unreachable (https://...): ECONNREFUSED"
		console.log(error.cause); // underlying transport error
	}
	// All errors have: status, statusText, body, problem, type, cause
	// (and method, url when an HttpApi method threw them)
}
```

**The message is what the server said.** The error's `message` is the one sentence found
in the response body: an RFC 9457 `detail` (or `title`), `error.message`, `message`, an
OAuth `error_description`, the first of `errors[]`, or the body itself when it is plain
text. A body that says nothing readable (empty, an HTML error page, an unknown JSON
shape) leaves the status phrase, `"Bad Gateway"`. See
[`getBodyMessage`](API.md#getbodymessage) for the exact order, and
[the extractors](API.md#createhttpapidefaulterrormessageextractor) to replace it.

### Problem Details (RFC 9457)

When a server refuses with `application/problem+json`, branch on the problem's `type`,
not on the status. One status covers unrelated refusals, and the `type` is the part of
the document meant to stay stable:

```ts
try {
	await api.patch(`/orders/${id}`, changes);
} catch (error) {
	if (error instanceof HTTP_ERROR.HttpError) {
		switch (error.type) {
			case "urn:example:error:conflict":
				return askWhichVersionToKeep();
			case "urn:example:error:validation":
				return showFieldErrors(error.problem.errors);
		}
		showError(error.message); // the problem's `detail`, or its `title`
	}
	throw error;
}
```

`error.problem` is always there. A response that is not a problem document is RFC 9457's
own `"about:blank"`: the status phrase as its `title`, and the body's sentence, when it
has one, as its `detail`. So `error.type` needs no guard.

The same reading is exported as [`problemOf(body, response)`](API.md#problemof) for code
that calls `fetch` itself.

### Diagnosing Failures in Production

The two failure modes carry request context differently, which is worth knowing before you
go looking for a URL that isn't there:

| Failure                             | Thrown         | URL in `.message`?         |
| ----------------------------------- | -------------- | -------------------------- |
| Transport (DNS, ECONNREFUSED, CORS) | `NetworkError` | yes, always                |
| HTTP non-2xx (404, 502, …)          | `HTTP_ERROR.*` | no — it's the server's own |

A transport failure never reached a server, so `fetchOrThrow` builds the message itself
and puts the URL in it. A non-2xx _did_ reach one, so the message is whatever the server
said — `"Bot backend unavailable"` and nothing more.

The URL is always on the error itself, with the method (fully resolved: base + path +
query, and post-redirect where the runtime reports it):

```ts
try {
	await api.get("/resource");
} catch (error) {
	// status > 0 excludes NetworkError, which never got a response
	if (error instanceof HTTP_ERROR.HttpError && error.status > 0) {
		log.error(`${error.method} ${error.url} → ${error.status}: ${error.message}`);
	}
}
```

The response headers are on the error's `cause` (see
[`HttpErrorCause`](API.md#httperrorcause)).

If the shipped log line is the only artifact you get — you log `error.message` and nothing
else — opt in to having the URL appended to the message itself:

```ts
// once, at the app entry point
createHttpApi.global.appendUrlToErrorMessage = true;
// a 502 now throws: "Bot backend unavailable (GET https://api.example.com/v2/bot?id=7)"
```

Off by default, because thrown messages are outward-facing (rendered in UI, matched on in
tests). It is applied _after_ extraction, so it decorates whichever error extractor won
and cannot be bypassed by a per-request or per-instance one, and `NetworkError` messages
are left alone (they already carry the URL).

`true` appends the URL verbatim, query string included. If yours carry credentials, pass a
formatter instead — it renders the parenthesized part, and returning an empty string skips
the append altogether:

```ts
// redact the query string
createHttpApi.global.appendUrlToErrorMessage = ({ method, url }) =>
	`${method} ${url.split("?")[0]}`;

// or decorate only server errors
createHttpApi.global.appendUrlToErrorMessage = ({ method, url, status }) =>
	status >= 500 ? `${method} ${url}` : "";
```

This affects the message only — `error.url` always carries the unredacted URL.

### Key Features

- **Auto JSON**: Response bodies are automatically parsed as JSON; empty bodies (204/205)
  return `null`
- **Smart body handling**: Plain objects → JSON; `FormData` / `URLSearchParams` / `Blob` /
  typed arrays / `ReadableStream` pass through; strings sent as-is
- **Query params**: Pass `query: { page: 1, tag: ["a", "b"] }` for URL search params
- **Timeouts**: Pass `timeout: 5000` for automatic request cancellation
- **Bearer tokens**: Use `token` param to auto-add `Authorization: Bearer` header
- **Response headers**: Pass `respHeaders: {}` to capture response headers
- **Raw response**: Use `raw: true` to get the raw Response object (caller must consume
  the body)
- **Non-throwing**: Use `assert: false` to prevent throwing on errors
- **AbortController**: Pass `signal` for request cancellation (composes with `timeout`)
- **Interceptors**: `api.onRequest(...)` / `api.onResponse(...)` for tracing, auth
  refresh, etc.
- **Diagnosable errors**: every HTTP error carries the request method and the fully
  resolved URL (`error.method`, `error.url`); opt in to
  `createHttpApi.global.appendUrlToErrorMessage` to get them in `message` too
- **One identity across copies**: `instanceof HTTP_ERROR.NotFound` holds for an error
  thrown by another installed copy of this package
- **Typed responses**: Use generics for type-safe responses: `api.get<User>("/users/1")`

### Query, Timeout, Interceptors

```ts
// Query params
await api.get("/search", { query: { q: "hi", tag: ["a", "b"] } });

// Timeout (abort after 5s; composes with AbortSignal)
await api.get("/slow", { timeout: 5000 });

// Interceptors
api.onRequest((init, { method, url }) => {
	console.log(method, url);
}).onResponse(async (resp) => {
	if (resp.status === 401) await refreshToken();
});
```

## Full API Reference

For complete API documentation including all error classes, HTTP status codes, types, and
utilities, see **[API.md](API.md)**.

## Utilities

### `fetchOrThrow(input, init?, whatOrOptions?)`

Wraps the native `fetch` so a transport-level failure surfaces the target host and the
real reason instead of an opaque `TypeError: fetch failed`. On failure it throws a
`NetworkError` (in the `HTTP_ERROR` namespace) whose message includes the URL and reason,
and whose `cause` is the underlying transport error. Deliberate
`AbortError`/`TimeoutError` are re-thrown untouched. The `HttpApi` client uses this
internally — reach for it directly when wrapping your own `fetch` calls.

The 3rd argument is either a label string or a `FetchOrThrowOptions` object carrying that
label plus optional `onRequest`/`onError` observer hooks.

```ts
import { fetchOrThrow, HTTP_ERROR } from "@marianmeres/http-utils";

try {
	const res = await fetchOrThrow(
		"https://issuer.example.com/jwks",
		undefined,
		"Token issuer",
	);
} catch (e) {
	if (e instanceof HTTP_ERROR.NetworkError) {
		console.log(e.message); // "Token issuer unreachable (https://issuer.example.com/jwks): ENOTFOUND"
	}
}
```

**Tracing requests.** The `onRequest`/`onError` hooks are pure observers (they can't
recover or transform anything) — handy for logging, and the only way to catch a _hang_
where neither a response nor an error ever arrives. Set defaults once on
`fetchOrThrow.global` (overridable per call; resolution is `per-call ?? global`). Because
`HttpApi` routes through `fetchOrThrow`, the global hooks instrument it too.

```ts
// app-wide defaults (also fire for every HttpApi request)
fetchOrThrow.global.onRequest = ({ method, url }) => console.debug(`→ ${method} ${url}`);
fetchOrThrow.global.onError = ({ url, kind, reason }) =>
	kind !== "abort" && console.error(`✗ ${url}: ${reason}`); // kind: "abort" | "timeout" | "network"

// per-call override (here: silence the global tracer for one call)
await fetchOrThrow(url, init, { what: "Token issuer", onRequest: () => {} });
```

See [API.md](./API.md#fetchorthrow) for the full options reference.

### `getErrorMessage(error)`

Extracts a human-readable message from anything that was thrown: this package's errors,
a plain `Error`, a string, or another package's error class that has the same members
(the exported [`HttpErrorLike`](API.md#httperrorlike) type):

```ts
import { getErrorMessage } from "@marianmeres/http-utils";

try {
	await api.get("/fail");
} catch (error) {
	console.log(getErrorMessage(error)); // "Not Found"
}
```

It never answers `"[object Object]"` or the source of an HTML error page.

### `createHttpError(code, message?, body?, cause?)`

Manually create HTTP errors:

```ts
import { createHttpError } from "@marianmeres/http-utils";

const error = createHttpError(404, "User not found", { userId: 123 });
throw error; // instanceof HTTP_ERROR.NotFound
```

## Upgrading from 2.x

3.0 changes what a thrown error says, so check anything that matches on `message`.

- **`message` of an `HttpApi` error.** 2.x read `error.message`, `message` and `error`
  from the body, and used the status text for everything else. 3.0 reads every convention
  [`getBodyMessage`](API.md#getbodymessage) knows, so an RFC 9457 `detail`, an OAuth
  `error_description` or a plain-text body is now the message where it used to be
  `"Bad Request"`. Branch on `status` or `type` instead of the text. To keep the 2.x
  reading:

  ```ts
  createHttpApi.defaultErrorMessageExtractor = (body: any, response) =>
  	String(body?.error?.message || body?.message || body?.error || response.statusText);
  ```

- **No more `"Unknown error"`.** When nothing readable was said, the message is the
  status phrase: the server's, or the standard one for the status when there is none (as
  over HTTP/2). An extractor that returns an empty string gets the same fallback.
- **`getErrorMessage`.** An error carrying a typed problem document (`error.problem.type`
  other than `"about:blank"`) answers with that document's `detail` or `title` before its
  `cause`. Members that are not a string or a number are skipped instead of rendered as
  `"[object Object]"`, a body that is markup is not a message, and a plain-text body is
  trimmed and cut at 500 characters.
- **New members on `HttpError`.** `problem` and `type` (getters), and `method` and `url`
  on errors an `HttpApi` method threw (these two are own properties, so they appear in
  `JSON.stringify(error)`). A subclass of yours that declares a member with one of these
  names has to agree with them.
- **`instanceof` across copies.** Classes are matched by a key every copy shares, so an
  error from another installed copy of 3.x is an instance here. That does not reach back:
  a 2.x copy and a 3.x copy do not recognize each other's errors, so move the packages of
  one install together.
- **`createHttpApi.defaultErrorMessageExtractor`** is shared by every bundled copy of the
  package, as `createHttpApi.global` already was.
- **`HTTP_STATUS`** text of 402 and 425 is `"Payment Required"` and `"Too Early"` (the
  keys keep their `_EXPERIMENTAL` suffix).

## Development

Node LTS (`.node-version`), pnpm, Biome, `node:test`. The source is erasable-only
TypeScript that Node runs directly; `dist/` is built only for publishing to npm. JSR is
served the `.ts` source (`jsr.json`).

| Command                             | Does                                                                   |
| ----------------------------------- | ---------------------------------------------------------------------- |
| `pnpm install`                      | installs the dev tooling                                               |
| `pnpm test` / `pnpm run test:watch` | `node --test` over `tests/**/*.test.ts`                                |
| `pnpm run test:deno`                | the same suite on Deno, as JSR consumers run it                        |
| `pnpm run typecheck`                | `tsc --noEmit` over `src` and `tests`                                  |
| `pnpm run typecheck:consumer`       | builds `dist/` and type-checks it the way a downstream project sees it |
| `pnpm run lint` / `pnpm run format` | `biome check .` read-only / with `--write`                             |
| `pnpm run ci`                       | typecheck + lint + test + consumer typecheck, what CI runs             |
| `pnpm run build`                    | `tsc -p tsconfig.build.json` → `dist/`                                 |
| `pnpm run jsr:check`                | `deno publish --dry-run`: the JSR file set and Deno's type check       |
| `pnpm run rp` / `pnpm run rpm`      | patch / minor release: npm, then JSR                                   |
