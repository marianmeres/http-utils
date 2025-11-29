# @marianmeres/http-utils

Opinionated, lightweight HTTP client wrapper for `fetch` with type-safe errors and convenient defaults.

## Features

- 🎯 **Type-safe HTTP errors** - Well-known status codes map to specific error classes
- 🔧 **Convenient defaults** - Auto JSON parsing, Bearer tokens, base URLs
- 🪶 **Lightweight** - Zero dependencies, thin wrapper over native `fetch`
- 🎨 **Flexible error handling** - Three-tier error message extraction (local → factory → global)
- 📦 **Deno & Node.js** - Works in both runtimes

## Installation

### Deno
```shell
deno add jsr:@marianmeres/http-utils
```

```shell
npm install @marianmeres/http-utils
```

```ts
import { createHttpApi, HTTP_ERROR } from "@marianmeres/http-utils";
```

## Quick Start

```ts
import { createHttpApi, HTTP_ERROR, NotFound } from "@marianmeres/http-utils";

// Create an API client with base URL
const api = createHttpApi("https://api.example.com", {
  headers: { "Authorization": "Bearer your-token" }
});

// GET request (new options API - recommended)
const users = await api.get("/users", {
  params: { headers: { "X-Custom": "value" } }
});

// POST request (new options API - recommended)
const newUser = await api.post("/users", {
  data: { name: "John Doe" },
  params: { headers: { "X-Custom": "value" } }
});

// Legacy API still works
const legacyUsers = await api.get("/users", { headers: { "X-Custom": "value" } });
const legacyUser = await api.post("/users", { name: "John Doe" });

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
    console.log(error.body);   // Response body
  }
}
```

## API Reference

### `createHttpApi(base?, defaults?, errorExtractor?)`

Creates an HTTP API client.

**Parameters:**
- `base` - Optional base URL for all requests
- `defaults` - Optional default params (headers, credentials, etc.) or async function returning defaults
- `errorExtractor` - Optional global error message extractor function

**Returns:** Object with methods: `get`, `post`, `put`, `patch`, `del`, `url`, `base`

### HTTP Methods

All methods return the parsed response body (JSON if possible) or throw `HttpError` on failure.

**New Options API (recommended):**
```ts
// GET with options
await api.get(path, {
  params?: { headers?, signal?, credentials?, raw?, assert?, token? },
  respHeaders?: {},
  errorExtractor?: (body, response) => string
});

// POST/PUT/PATCH/DELETE with options
await api.post(path, {
  data?: any,  // Request body
  params?: { headers?, signal?, credentials?, raw?, assert?, token? },
  respHeaders?: {},
  errorExtractor?: (body, response) => string
});
```

**Legacy API (still supported):**
```ts
// GET
await api.get(path, params?, respHeaders?, errorExtractor?)

// POST, PUT, PATCH, DELETE
await api.post(path, data?, params?, respHeaders?, errorExtractor?)
```

**Common params:**
- `headers` - Custom headers object
- `token` - Bearer token (auto-adds `Authorization: Bearer {token}`)
- `signal` - AbortSignal for cancellation
- `credentials` - `'omit' | 'same-origin' | 'include'`
- `raw` - Return raw Response object instead of parsed body
- `assert` - Set to `false` to disable throwing on errors

### Response Headers

Access response headers by passing a respHeaders object:

```ts
// New API
const headers = {};
const data = await api.get("/users", { respHeaders: headers });

console.log(headers.__http_status_code__); // 200
console.log(headers["content-type"]);      // "application/json"

// Legacy API
const legacyHeaders = {};
const data2 = await api.get("/users", {}, legacyHeaders);
```

### Error Classes

Well-known HTTP errors have specific classes:

**Client Errors (4xx):**
- `BadRequest` (400)
- `Unauthorized` (401)
- `Forbidden` (403)
- `NotFound` (404)
- `MethodNotAllowed` (405)
- `RequestTimeout` (408)
- `Conflict` (409)
- `Gone` (410)
- `LengthRequired` (411)
- `ImATeapot` (418)
- `UnprocessableContent` (422)
- `TooManyRequests` (429)

**Server Errors (5xx):**
- `InternalServerError` (500)
- `NotImplemented` (501)
- `BadGateway` (502)
- `ServiceUnavailable` (503)

All errors extend `HttpError` with properties:
- `status` - HTTP status code
- `statusText` - HTTP status text
- `body` - Response body (auto-parsed as JSON if possible)
- `cause` - Error details/context

### HTTP Status Codes

Access status codes via `HTTP_STATUS`:

```ts
import { HTTP_STATUS } from "@marianmeres/http-utils";

// By category
HTTP_STATUS.SUCCESS.OK.CODE          // 200
HTTP_STATUS.ERROR_CLIENT.NOT_FOUND.CODE  // 404

// Direct shortcuts
HTTP_STATUS.OK              // 200
HTTP_STATUS.NOT_FOUND       // 404
HTTP_STATUS.INTERNAL_SERVER_ERROR  // 500

// Lookup by code
const info = HTTP_STATUS.findByCode(404);
// { CODE: 404, TEXT: "Not Found", _TYPE: "ERROR_CLIENT", _KEY: "NOT_FOUND" }
```

## Advanced Usage

### Error Message Extraction

Customize how error messages are extracted from failed responses:

```ts
// Global default
createHttpApi.defaultErrorMessageExtractor = (body, response) => {
  return body.error?.message || response.statusText;
};

// Per-instance
const api = createHttpApi(null, null, (body) => body.customError);

// Per-request
await api.get("/path", null, null, (body) => body.message);
```

Priority: per-request → per-instance → global → built-in fallback

### Dynamic Configuration

```ts
const api = createHttpApi("https://api.example.com", async () => {
  const token = await getToken(); // Fetch fresh token
  return { headers: { "Authorization": `Bearer ${token}` } };
});
```

### Raw Response Access

```ts
const response = await api.get("/users", { raw: true });
console.log(response instanceof Response); // true
const data = await response.json();
```

### Non-Throwing Errors

```ts
const data = await api.get("/might-fail", { assert: false });
if (data.error) {
  console.log("Request failed:", data.error.message);
}
```

### AbortController Support

```ts
const controller = new AbortController();

setTimeout(() => controller.abort(), 5000);

await api.get("/slow-endpoint", { signal: controller.signal });
```

## Utilities

### `getErrorMessage(error, stripErrorPrefix?)`

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
throw error;
```

## License

MIT
