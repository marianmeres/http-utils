# API Documentation

Complete API reference for `@marianmeres/http-utils`.

## Table of Contents

- [createHttpApi](#createhttpapi)
- [HttpApi Class](#httpapi-class)
- [Types](#types)
- [HTTP Errors](#http-errors)
- [HTTP Status Codes](#http-status-codes)
- [Utilities](#utilities)

---

## createHttpApi

Creates an HTTP API client with convenient defaults and error handling.

```ts
function createHttpApi(
  base?: string | null,
  defaults?: Partial<FetchParams> | (() => Promise<Partial<FetchParams>>),
  factoryErrorMessageExtractor?: ErrorMessageExtractor | null
): HttpApi
```

### Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `base` | `string \| null` | Optional base URL to prepend to all requests. |
| `defaults` | `object \| function` | Optional default parameters or async function returning defaults. |
| `factoryErrorMessageExtractor` | `ErrorMessageExtractor \| null` | Optional function to extract error messages from failed responses. |

### Returns

An `HttpApi` instance with methods: `get`, `post`, `put`, `patch`, `del`, `url`, and `base` property.

### Example

```ts
import { createHttpApi } from "@marianmeres/http-utils";

// Basic usage
const api = createHttpApi("https://api.example.com");

// With default headers
const api = createHttpApi("https://api.example.com", {
  headers: { "Authorization": "Bearer token" }
});

// With dynamic defaults (e.g., for token refresh)
const api = createHttpApi("https://api.example.com", async () => {
  const token = await getToken();
  return { headers: { "Authorization": `Bearer ${token}` } };
});

// With custom error extractor
const api = createHttpApi("https://api.example.com", null, (body) => {
  return body?.error?.message || "Unknown error";
});
```

### Static Properties

#### `createHttpApi.defaultErrorMessageExtractor`

Global default error message extractor. Applied to all requests unless overridden.

```ts
createHttpApi.defaultErrorMessageExtractor = (body, response) => {
  return body?.error?.message || response.statusText;
};
```

Priority order: per-request > per-instance > global > built-in fallback.

---

## HttpApi Class

HTTP API client class. Usually created via `createHttpApi()`.

### Methods

#### `get<T>(path, options?)`

Performs a GET request.

**New Options API (recommended):**
```ts
async get<T = unknown>(path: string, options?: GetOptions): Promise<T>
```

**Legacy API:**
```ts
async get<T = unknown>(
  path: string,
  params?: FetchParams,
  respHeaders?: ResponseHeaders | null,
  errorMessageExtractor?: ErrorMessageExtractor | null
): Promise<T>
```

**Example:**
```ts
// New API with type parameter
interface User { id: number; name: string; }
const user = await api.get<User>("/users/1", {
  params: { headers: { "X-Custom": "value" } },
  respHeaders: {}
});

// Without type parameter (returns unknown)
const data = await api.get("/users");

// Legacy API
const data = await api.get("/users", { headers: { "X-Custom": "value" } });
```

#### `post<T>(path, options?)`

Performs a POST request.

**New Options API (recommended):**
```ts
async post<T = unknown>(path: string, options?: DataOptions): Promise<T>
```

**Legacy API:**
```ts
async post<T = unknown>(
  path: string,
  data?: RequestData,
  params?: FetchParams,
  respHeaders?: ResponseHeaders | null,
  errorMessageExtractor?: ErrorMessageExtractor | null
): Promise<T>
```

**Example:**
```ts
// New API with type parameter
interface User { id: number; name: string; }
const user = await api.post<User>("/users", {
  data: { name: "John" },
  params: { headers: { "X-Custom": "value" } }
});

// Legacy API
const result = await api.post("/users", { name: "John" });
```

#### `put<T>(path, options?)`

Performs a PUT request. Same signature as `post<T>()`.

#### `patch<T>(path, options?)`

Performs a PATCH request. Same signature as `post<T>()`.

#### `del<T>(path, options?)`

Performs a DELETE request. Same signature as `post<T>()`.

#### `url(path)`

Builds the full URL from a path.

```ts
url(path: string): string
```

**Example:**
```ts
const api = createHttpApi("https://api.example.com");
api.url("/users"); // "https://api.example.com/users"
api.url("https://other.com/path"); // "https://other.com/path" (absolute URLs returned as-is)
```

### Properties

#### `base`

Get or set the base URL.

```ts
get base(): string | null | undefined
set base(v: string | null | undefined)
```

---

## Types

### RequestData

Request body data type.

```ts
type RequestData = Record<string, unknown> | FormData | string | null;
```

### FetchParams

Parameters for fetch requests.

```ts
interface FetchParams {
  /** Request body data (automatically JSON stringified unless FormData). */
  data?: RequestData;
  /** Bearer token (auto-adds `Authorization: Bearer {token}` header). */
  token?: string | null;
  /** Custom request headers. */
  headers?: Record<string, string> | null;
  /** AbortSignal for request cancellation. */
  signal?: AbortSignal;
  /** Credentials mode for the request. */
  credentials?: 'omit' | 'same-origin' | 'include' | null;
  /** If true, returns the raw Response object instead of parsed body. */
  raw?: boolean | null;
  /** If false, does not throw on HTTP errors (default: true). */
  assert?: boolean | null;
}
```

### GetOptions

Options for HTTP GET requests (new API).

```ts
interface GetOptions {
  /** Fetch parameters (headers, token, signal, credentials, raw, assert). */
  params?: FetchParams;
  /** Object to receive response headers (will be mutated). */
  respHeaders?: ResponseHeaders | null;
  /** Custom error message extractor for this request. */
  errorExtractor?: ErrorMessageExtractor | null;
}
```

### DataOptions

Options for HTTP POST/PUT/PATCH/DELETE requests (new API).

```ts
interface DataOptions {
  /** Request body data. */
  data?: RequestData;
  /** Fetch parameters (headers, token, signal, credentials, raw, assert). */
  params?: FetchParams;
  /** Object to receive response headers (will be mutated). */
  respHeaders?: ResponseHeaders | null;
  /** Custom error message extractor for this request. */
  errorExtractor?: ErrorMessageExtractor | null;
}
```

### ResponseHeaders

Object to receive response headers after a request completes.

```ts
type ResponseHeaders = Record<string, string | number>;
```

Special keys added after request:
- `__http_status_code__`: The HTTP status code
- `__http_status_text__`: The HTTP status text

### ErrorMessageExtractor

Function to extract error messages from failed HTTP responses.

```ts
type ErrorMessageExtractor = (body: unknown, response: Response) => string;
```

---

## HTTP Errors

All errors extend `HttpError` base class.

### HttpError (Base Class)

```ts
class HttpError extends Error {
  status: number;      // HTTP status code
  statusText: string;  // HTTP status text
  body: unknown;       // Response body (auto-parsed as JSON)
  cause: unknown;      // Error cause/details
}
```

### Client Errors (4xx)

| Class | Status | Description |
|-------|--------|-------------|
| `BadRequest` | 400 | Bad Request |
| `Unauthorized` | 401 | Unauthorized |
| `Forbidden` | 403 | Forbidden |
| `NotFound` | 404 | Not Found |
| `MethodNotAllowed` | 405 | Method Not Allowed |
| `RequestTimeout` | 408 | Request Timeout |
| `Conflict` | 409 | Conflict |
| `Gone` | 410 | Gone |
| `LengthRequired` | 411 | Length Required |
| `ImATeapot` | 418 | I'm a Teapot |
| `UnprocessableContent` | 422 | Unprocessable Content |
| `TooManyRequests` | 429 | Too Many Requests |

### Server Errors (5xx)

| Class | Status | Description |
|-------|--------|-------------|
| `InternalServerError` | 500 | Internal Server Error |
| `NotImplemented` | 501 | Not Implemented |
| `BadGateway` | 502 | Bad Gateway |
| `ServiceUnavailable` | 503 | Service Unavailable |

### HTTP_ERROR Namespace

All error classes are available via the `HTTP_ERROR` namespace:

```ts
import { HTTP_ERROR } from "@marianmeres/http-utils";

try {
  await api.get("/resource");
} catch (error) {
  if (error instanceof HTTP_ERROR.NotFound) {
    console.log("Resource not found");
  }
  if (error instanceof HTTP_ERROR.HttpError) {
    console.log("HTTP error:", error.status);
  }
}
```

---

## HTTP Status Codes

### HTTP_STATUS Class

Access status codes by category or via direct shortcuts.

#### Categories

```ts
HTTP_STATUS.INFO           // 1xx Informational
HTTP_STATUS.SUCCESS        // 2xx Success
HTTP_STATUS.REDIRECT       // 3xx Redirection
HTTP_STATUS.ERROR_CLIENT   // 4xx Client Error
HTTP_STATUS.ERROR_SERVER   // 5xx Server Error
```

#### Category Access

```ts
HTTP_STATUS.SUCCESS.OK.CODE                  // 200
HTTP_STATUS.SUCCESS.OK.TEXT                  // "OK"
HTTP_STATUS.ERROR_CLIENT.NOT_FOUND.CODE      // 404
HTTP_STATUS.ERROR_CLIENT.NOT_FOUND.TEXT      // "Not Found"
```

#### Direct Shortcuts

```ts
HTTP_STATUS.OK                    // 200
HTTP_STATUS.CREATED               // 201
HTTP_STATUS.ACCEPTED              // 202
HTTP_STATUS.NO_CONTENT            // 204
HTTP_STATUS.MOVED_PERMANENTLY     // 301
HTTP_STATUS.FOUND                 // 302
HTTP_STATUS.NOT_MODIFIED          // 304
HTTP_STATUS.BAD_REQUEST           // 400
HTTP_STATUS.UNAUTHORIZED          // 401
HTTP_STATUS.FORBIDDEN             // 403
HTTP_STATUS.NOT_FOUND             // 404
HTTP_STATUS.METHOD_NOT_ALLOWED    // 405
HTTP_STATUS.CONFLICT              // 409
HTTP_STATUS.GONE                  // 410
HTTP_STATUS.UNPROCESSABLE_CONTENT // 422
HTTP_STATUS.TOO_MANY_REQUESTS     // 429
HTTP_STATUS.INTERNAL_SERVER_ERROR // 500
HTTP_STATUS.NOT_IMPLEMENTED       // 501
HTTP_STATUS.SERVICE_UNAVAILABLE   // 503
```

#### findByCode(code)

Lookup status code by numeric value.

```ts
static findByCode(code: number | string): {
  CODE: number;
  TEXT: string;
  _TYPE: string;
  _KEY: string;
} | null
```

**Example:**
```ts
const info = HTTP_STATUS.findByCode(404);
// { CODE: 404, TEXT: "Not Found", _TYPE: "ERROR_CLIENT", _KEY: "NOT_FOUND" }
```

---

## Utilities

### createHttpError

Creates an HTTP error from a status code and optional details.

```ts
function createHttpError(
  code: number | string,
  message?: string | null,
  body?: unknown,
  cause?: unknown
): HttpError
```

Returns a specific error class for well-known status codes.

**Example:**
```ts
const error = createHttpError(404, "User not found", { userId: 123 });
console.log(error instanceof NotFound); // true
console.log(error.status);              // 404
console.log(error.body);                // { userId: 123 }
```

### getErrorMessage

Extracts a human-readable error message from various error formats.

```ts
function getErrorMessage(e: unknown, stripErrorPrefix?: boolean): string
```

**Priority order:**
1. `e.cause.message` / `e.cause.code` / `e.cause` (if string)
2. `e.body.error.message` / `e.body.message` / `e.body.error` / `e.body` (if string)
3. `e.message`
4. `e.name`
5. `e.toString()`
6. `"Unknown Error"`

**Example:**
```ts
import { getErrorMessage } from "@marianmeres/http-utils";

try {
  await api.get("/fail");
} catch (error) {
  console.log(getErrorMessage(error)); // "Not Found"
}
```
