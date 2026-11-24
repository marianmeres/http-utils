# AGENTS.md - Machine-Readable Package Context

## Package Identity

```yaml
name: "@marianmeres/http-utils"
version: "2.12.0"
license: MIT
runtime: universal (web standards only; browsers, Node, any modern runtime)
type: library
category: http-client
```

## Purpose

Lightweight, opinionated HTTP client wrapper for the native `fetch` API. Provides
type-safe HTTP errors mapped to specific error classes (e.g., 404 → NotFound), convenient
defaults (auto JSON parsing, Bearer token support, base URLs), and flexible three-tier
error message extraction.

## Architecture

```
src/
├── mod.ts      # Public exports (main entry point)
├── api.ts      # HttpApi class, createHttpApi factory
├── error.ts    # HttpError classes, HTTP_ERROR namespace
└── status.ts   # HTTP_STATUS codes and lookup
```

## Public API

### Primary Export: createHttpApi

```typescript
function createHttpApi(
	base?: string | null,
	defaults?: Partial<FetchParams> | (() => Promise<Partial<FetchParams>>),
	factoryErrorMessageExtractor?: ErrorMessageExtractor | null,
): HttpApi;

// Static properties (global, shared via Symbol.for + globalThis across bundled copies):
createHttpApi.defaultErrorMessageExtractor; // ErrorMessageExtractor | null — "what did the server say"; bypassed by per-request/per-instance extractors
createHttpApi.global; // HttpApiGlobalOptions
createHttpApi.global.appendUrlToErrorMessage; // boolean | ErrorUrlFormatter, default false
```

`appendUrlToErrorMessage` appends `" (<METHOD> <resolved url>)"` to the message of every
HTTP error thrown by an `HttpApi` method. Applied AFTER extraction, so it decorates
whichever extractor won and cannot be bypassed; the URL is never truncated (the built-in
255-char cap applies to the server message only); `NetworkError` is untouched (its message
already embeds the URL). Off by default — thrown messages are outward-facing. Mirrors the
`fetchOrThrow.global` pattern. Do NOT use `defaultErrorMessageExtractor` for this job.

Set it to an `ErrorUrlFormatter` instead of `true` to render the appended text yourself
(redaction, conditional decoration). A formatter that returns a blank/non-string, or that
throws, appends nothing — it deliberately does NOT fall back to the raw URL, so a broken
redactor fails closed. The message is the only thing affected; `cause.url` is always the
unredacted URL.

### HttpApi Methods

| Method       | Signature                                              | Description                                                          |
| ------------ | ------------------------------------------------------ | -------------------------------------------------------------------- |
| `get`        | `get(path, options?: GetOptions): Promise<unknown>`    | GET request                                                          |
| `post`       | `post(path, options?: DataOptions): Promise<unknown>`  | POST request                                                         |
| `put`        | `put(path, options?: DataOptions): Promise<unknown>`   | PUT request                                                          |
| `patch`      | `patch(path, options?: DataOptions): Promise<unknown>` | PATCH request                                                        |
| `del`        | `del(path, options?: DataOptions): Promise<unknown>`   | DELETE request                                                       |
| `url`        | `url(path: string): string`                            | Build full URL (base trailing slash + path leading slash normalized) |
| `base`       | `get/set base: string \| null`                         | Base URL property                                                    |
| `onRequest`  | `onRequest(i: RequestInterceptor \| null): this`       | Register request interceptor                                         |
| `onResponse` | `onResponse(i: ResponseInterceptor \| null): this`     | Register response interceptor                                        |

### Exported Types

```typescript
type RequestData =
	| Record<string, unknown>
	| unknown[]
	| FormData
	| Blob
	| ArrayBuffer
	| ArrayBufferView
	| URLSearchParams
	| ReadableStream
	| string
	| number
	| boolean
	| null;

type QueryValue =
	| string
	| number
	| boolean
	| (string | number | boolean)[]
	| null
	| undefined;

interface FetchParams {
	data?: RequestData;
	token?: string | null;
	headers?: HeadersInit | null;
	signal?: AbortSignal;
	timeout?: number | null; // ms
	query?: Record<string, QueryValue> | null;
	credentials?: "omit" | "same-origin" | "include" | null;
	raw?: boolean | null;
	assert?: boolean | null;
}

interface GetOptions {
	params?: FetchParams;
	respHeaders?: ResponseHeaders | null;
	errorExtractor?: ErrorMessageExtractor | null;
}

interface DataOptions {
	data?: RequestData;
	params?: FetchParams;
	respHeaders?: ResponseHeaders | null;
	errorExtractor?: ErrorMessageExtractor | null;
}

type ErrorMessageExtractor = (body: unknown, response: Response) => string;
type ResponseHeaders = Record<string, string | number>;

interface HttpApiGlobalOptions {
	appendUrlToErrorMessage?: boolean | ErrorUrlFormatter;
}

// Renders the parenthesized text appended to an HTTP error message. Return the URL text
// only (the package supplies the framing). Empty string / null / undefined => no append.
type ErrorUrlFormatter = (info: {
	url: string; // fully resolved (same as cause.url)
	method: string;
	path: string; // resolved against base, no query string
	status: number;
}) => string | null | undefined;

type RequestInterceptor = (
	init: RequestInit,
	ctx: { method: string; url: string },
) => RequestInit | void | Promise<RequestInit | void>;

type ResponseInterceptor = (
	response: Response,
	ctx: { method: string; url: string },
) => Response | void | Promise<Response | void>;
```

### Error Classes (HTTP_ERROR namespace)

```typescript
HTTP_ERROR.HttpError; // Base class (default 500)
HTTP_ERROR.BadRequest; // 400
HTTP_ERROR.Unauthorized; // 401
HTTP_ERROR.Forbidden; // 403
HTTP_ERROR.NotFound; // 404
HTTP_ERROR.MethodNotAllowed; // 405
HTTP_ERROR.RequestTimeout; // 408
HTTP_ERROR.Conflict; // 409
HTTP_ERROR.Gone; // 410
HTTP_ERROR.LengthRequired; // 411
HTTP_ERROR.ImATeapot; // 418
HTTP_ERROR.UnprocessableContent; // 422
HTTP_ERROR.TooManyRequests; // 429
HTTP_ERROR.InternalServerError; // 500
HTTP_ERROR.NotImplemented; // 501
HTTP_ERROR.BadGateway; // 502
HTTP_ERROR.ServiceUnavailable; // 503
HTTP_ERROR.NetworkError; // 0 (transport-level failure: DNS/refused/timeout/unreachable; extends HttpError, cause = underlying error)
```

Every HTTP error thrown by an `HttpApi` method (non-2xx) carries request context as
`cause` (exported as `HttpErrorCause`):

```typescript
interface HttpErrorCause {
	method: string;
	path: string; // resolved against base, NO query string — legacy, prefer `url`
	url: string; // base + path + query, post-redirect; falls back to the requested URL
	//              when a response interceptor returned a synthetic Response (`r.url` is "")
	response: { status: number; statusText: string; headers: ResponseHeaders };
}
```

Not applicable to `NetworkError` — no response was received, so its `cause` is the
underlying transport error.

### Helper Functions

```typescript
// Marks options object for options-based API (vs legacy positional API)
function opts<T extends GetOptions | DataOptions>(options: T): T;
```

### Utility Functions

```typescript
function createHttpError(
	code: number | string,
	message?: string | null,
	body?: unknown,
	cause?: unknown,
): HttpError;
function getErrorMessage(e: unknown, stripErrorPrefix?: boolean): string;
// Wraps fetch; on transport failure throws NetworkError("<what> unreachable (<url>): <reason>", { cause }).
// AbortError/TimeoutError pass through untouched. Used internally by HttpApi.
// 3rd arg is a label string OR FetchOrThrowOptions { what?, onRequest?, onError? } (pure observers; a string normalizes to { what }).
// onRequest fires before dispatch (throw => request not sent). onError fires on every failure
//   with { error, url, what?, kind: "abort"|"timeout"|"network", reason } (reason via getErrorMessage;
//   throw => swallowed, real error preserved).
// Global defaults (overridable per call; resolution: per-call ?? global; instruments HttpApi too):
//   fetchOrThrow.global.onRequest / fetchOrThrow.global.onError
function fetchOrThrow(
	input: string | URL | Request,
	init?: RequestInit,
	whatOrOptions?: string | FetchOrThrowOptions,
): Promise<Response>;
```

### HTTP Status Codes

```typescript
class HTTP_STATUS {
  static readonly INFO: {...}           // 1xx
  static readonly SUCCESS: {...}        // 2xx
  static readonly REDIRECT: {...}       // 3xx
  static readonly ERROR_CLIENT: {...}   // 4xx
  static readonly ERROR_SERVER: {...}   // 5xx

  // Direct shortcuts
  static readonly OK: 200
  static readonly NOT_FOUND: 404
  // ... etc

  static findByCode(code: number | string): { CODE, TEXT, _TYPE, _KEY } | null
}
```

## Key Behaviors

1. **Auto JSON parsing**: Response bodies are parsed as JSON if possible; empty bodies
   (204/205) return `null`
2. **Bearer token**: `token` param auto-adds `Authorization: Bearer {token}` header
3. **Error throwing**: By default, non-OK responses throw HttpError (disable with
   `assert: false`)
4. **Response headers**: Pass `respHeaders: {}` to capture response headers (mutated in
   place)
5. **Raw response**: Use `raw: true` to get raw Response object; the caller must consume
   the body
6. **Error priority**: per-request extractor → per-instance → global → built-in fallback;
   a throwing extractor falls through to the next priority rather than crashing
7. **URL normalization**: `#url(path)` strips trailing `/` from base and ensures leading
   `/` on path, so `base + path` never produces `//` or missing `/`
8. **Timeout**: `params.timeout` (ms) aborts via `AbortSignal.timeout`; composed with
   `params.signal` via `AbortSignal.any`
9. **Query**: `params.query` object appended as URL search params; `null`/`undefined`
   skipped, arrays → repeated keys
10. **Transport errors**: connectivity failures (DNS, refused connection, unreachable
    host) throw `HTTP_ERROR.NetworkError` (status 0) via `fetchOrThrow`, with the real
    reason in the message and the underlying error as `cause` — never an opaque "fetch
    failed". Deliberate `AbortError`/`TimeoutError` are not wrapped.
11. **Request tracing**: `fetchOrThrow.global.onRequest` / `onError` are observer-only
    hooks (no recovery/transform), overridable per call (`per-call ?? global`). They also
    fire for `HttpApi` requests, since the client routes through `fetchOrThrow`.
12. **Error request context**: HTTP errors carry `cause.url` (fully resolved, query
    included) — `cause.path` predates it and omits the query. Transport failures already
    name the URL in the message; HTTP errors do not (the message is the server's own), so
    `createHttpApi.global.appendUrlToErrorMessage` opts into appending it there too.

## Request Body Serialization

| Runtime type                                                                         | Sent as                   | Content-Type set                                         |
| ------------------------------------------------------------------------------------ | ------------------------- | -------------------------------------------------------- |
| `null` / `undefined`                                                                 | No body                   | —                                                        |
| `string`                                                                             | raw                       | caller-controlled                                        |
| `number` / `boolean` / plain object / array                                          | `JSON.stringify`          | `application/json` only if not already set               |
| `FormData`, `URLSearchParams`, `Blob`, `ArrayBuffer`, typed arrays, `ReadableStream` | passed to fetch unchanged | fetch handles (e.g. multipart boundary, form-urlencoded) |

User-provided `Content-Type` header is always preserved.

## Development Commands

```bash
pnpm install                  # dev tooling (Node LTS from .node-version, pnpm)
pnpm test                     # node --test over tests/**/*.test.ts
pnpm run test:watch           # same, watch mode
pnpm run test:deno            # the same suite on Deno, via jsr.json (as JSR consumers run it)
pnpm run typecheck            # tsc --noEmit over src + tests (Node never checks types)
pnpm run typecheck:consumer   # build dist/, type-check it as a downstream project
pnpm run lint                 # biome check . (read-only)
pnpm run format               # biome check --write .
pnpm run ci                   # typecheck + lint + test + typecheck:consumer (what CI runs)
pnpm run build                # tsc -p tsconfig.build.json -> dist/
pnpm run jsr:check            # deno publish --dry-run: JSR file set + Deno's type check
pnpm run rp / pnpm run rpm    # patch / minor release (human only): ci, bump, tag, npm + JSR, push
```

## Tooling Conventions

1. **Runtime policy** — Node at the keyboard, npm as the registry. No `Deno.*`, `Bun.*`,
   `jsr:` or `npm:` specifiers in source; web standards only (the package ships to
   browsers). Nothing is built or tested for Bun. Deno exists only for JSR: `test:deno`
   runs the same suite against `jsr.json`, and `publish:jsr` runs it first.
2. **Erasable TypeScript** — no `enum`, `namespace`, constructor parameter properties;
   `import type` for types; explicit `.ts` import extensions (rewritten to `.js` on
   emit). `pnpm run typecheck` is the only type gate for `src` + `tests`.
3. **Manifests** — `package.json` is the manifest of record and holds the version; npm
   gets `dist/` (gitignored, built by `tsc`). `jsr.json` (no version; `publish:jsr`
   passes `--set-version`) gives JSR the `.ts` source, the tests and the docs.
4. **Expando declarations** — `fetchOrThrow.global` and `createHttpApi.global` are
   assigned `as FetchOrThrowGlobalOptions` / `as HttpApiGlobalOptions` in `src/api.ts`.
   The casts are type-only (erased from the JS) and not redundant: without them tsc 7
   emits the namespace so that `createHttpApi.defaultErrorMessageExtractor` is missing
   from the published `.d.ts`. `tests/consumer/` (`typecheck:consumer`, part of `ci`)
   checks the built package as a consumer and fails if it regresses.
5. **Formatting and lint** — Biome (`biome.json`): tabs, 4 wide, 90 columns, double
   quotes; manifests at 2 spaces. `pnpm run format` before committing. Two recommended
   rules are warnings on purpose: `noDoubleEquals` (`HTTP_STATUS.findByCode` compares with
   `==` so `"404"` matches 404; its fix is disabled) and `noAssignInExpressions` (the
   `??=` global singletons).
6. **Tests** — `node:test` + `node:assert/strict`. Mock servers use `serve()` from
   `tests/_helpers.ts` (`Request => Response` handlers over `node:http`, port 0).
   Global state (`fetchOrThrow.global`, `createHttpApi.global`,
   `defaultErrorMessageExtractor`) is per process: reset it in `afterEach` or `finally`.

## Dependencies

- **Runtime**: None (zero dependencies)
- **Dev**: TypeScript, Biome, `@types/node` (testing uses `node:test` and `node:assert`)

## File Locations

| Purpose                 | Path                                           |
| ----------------------- | ---------------------------------------------- |
| Entry point             | `src/mod.ts`                                   |
| HttpApi implementation  | `src/api.ts`                                   |
| Error classes           | `src/error.ts`                                 |
| Status codes            | `src/status.ts`                                |
| Tests                   | `tests/*.test.ts`, helpers `tests/_helpers.ts` |
| Consumer type check     | `tests/consumer/`                              |
| npm output (gitignored) | `dist/`                                        |
| Manifest of record      | `package.json`                                 |
| JSR config (no version) | `jsr.json`                                     |
| Type gate / build       | `tsconfig.json` / `tsconfig.build.json`        |
| Format + lint           | `biome.json`                                   |

## Common Patterns

### Basic Usage

```typescript
import { createHttpApi, opts } from "@marianmeres/http-utils";

const api = createHttpApi("https://api.example.com", {
	headers: { "Authorization": "Bearer token" },
});

// Legacy API (default - object is request body)
const data = await api.get("/users");
await api.post("/users", { name: "John" });

// Options API (requires opts() wrapper)
await api.post("/users", opts({ data: { name: "John" }, params: { token: "abc" } }));
```

### Error Handling

```typescript
try {
	await api.get("/resource");
} catch (error) {
	if (error instanceof HTTP_ERROR.NotFound) {
		// Handle 404
	}
}
```

### Dynamic Token

```typescript
const api = createHttpApi("https://api.example.com", async () => ({
	headers: { "Authorization": `Bearer ${await getToken()}` },
}));
```
