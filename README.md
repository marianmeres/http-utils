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
- 🛰️ **No swallowed transport errors** - DNS/connection failures surface the host and real
  reason instead of an opaque "fetch failed"
- 📦 **Deno & Node.js** - Works in both runtimes
- 🦾 **Generic return types** - Optional type parameters for typed responses

## Installation

```shell
deno add jsr:@marianmeres/http-utils
```

```shell
npm install @marianmeres/http-utils
```

```ts
import { createHttpApi, HTTP_ERROR, opts } from "@marianmeres/http-utils";
```

## Quick Start

```ts
import { createHttpApi, HTTP_ERROR, NotFound, opts } from "@marianmeres/http-utils";

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
	if (error instanceof NotFound) {
		console.log("Resource not found");
	}
	// or use the namespace
	if (error instanceof HTTP_ERROR.NotFound) {
		console.log(error.status); // 404
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
import { HTTP_ERROR, NotFound } from "@marianmeres/http-utils";

try {
	await api.get("/resource");
} catch (error) {
	if (error instanceof NotFound) {
		console.log("Not found:", error.body);
	}
	// Transport-level failures (DNS, refused connection, unreachable host) throw
	// a NetworkError (status 0) instead of an opaque "fetch failed":
	if (error instanceof HTTP_ERROR.NetworkError) {
		console.log(error.message); // e.g. "GET unreachable (https://...): ECONNREFUSED"
		console.log(error.cause); // underlying transport error
	}
	// All errors have: status, statusText, body, cause
}
```

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
fetchOrThrow.global.onError = ({ url, kind }) =>
	kind !== "abort" && console.error(`✗ ${url}`); // kind: "abort" | "timeout" | "network"

// per-call override (here: silence the global tracer for one call)
await fetchOrThrow(url, init, { what: "Token issuer", onRequest: () => {} });
```

See [API.md](./API.md#fetchorthrow) for the full options reference.

### `getErrorMessage(error)`

Extracts human-readable messages from any error format:

```ts
import { getErrorMessage } from "@marianmeres/http-utils";

try {
	await api.get("/fail");
} catch (error) {
	console.log(getErrorMessage(error)); // "Not Found"
}
```

### `createHttpError(code, message?, body?, cause?)`

Manually create HTTP errors:

```ts
import { createHttpError } from "@marianmeres/http-utils";

const error = createHttpError(404, "User not found", { userId: 123 });
throw error; // instanceof NotFound
```
