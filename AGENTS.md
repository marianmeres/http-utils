# AGENTS.md - Machine-Readable Package Context

## Package Identity

```yaml
name: "@marianmeres/http-utils"
version: "3.0.0"
license: MIT
runtime: universal (web standards only; browsers, Node, any modern runtime)
type: library
category: http-client
```

## Purpose

Lightweight, opinionated HTTP client wrapper for the native `fetch` API. Provides
type-safe HTTP errors mapped to specific error classes (e.g., 404 → NotFound), convenient
defaults (auto JSON parsing, Bearer token support, base URLs), flexible three-tier error
message extraction, and RFC 9457 Problem Details read out of the box (`error.problem`,
`error.type`).

## Architecture

```
src/
├── mod.ts      # Public exports (main entry point)
├── api.ts      # HttpApi class, createHttpApi factory, fetchOrThrow
├── error.ts    # HttpError classes, HTTP_ERROR namespace, createHttpError, getErrorMessage
├── problem.ts  # getBodyMessage, problemOf (RFC 9457); imports status.ts only
└── status.ts   # HTTP_STATUS codes and lookup
```

Import direction: `api.ts → error.ts → problem.ts → status.ts`. Reading a body lives in
`problem.ts` and nowhere else: the thrown `message`, `HttpError.problem` and
`getErrorMessage` all go through it.

## Public API

### Primary Export: createHttpApi

```typescript
function createHttpApi(
	base?: string | null,
	defaults?: Partial<FetchParams> | (() => Promise<Partial<FetchParams>>),
	factoryErrorMessageExtractor?: ErrorMessageExtractor | null,
): HttpApi;

// Static properties (global, shared via Symbol.for + globalThis across bundled copies):
createHttpApi.defaultErrorMessageExtractor; // ErrorMessageExtractor | null — "what did the server say"; bypassed by per-request/per-instance extractors; an accessor over a globalThis slot
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

type ErrorMessageExtractor = (body: unknown, response: Response) => string; // "" => status phrase
type ResponseHeaders = Record<string, string | number>;

// RFC 9457. type/title/status are always present in what this package returns.
interface ProblemDetails {
	type: string; // a URI, or "about:blank"
	title: string;
	status: number;
	detail?: string;
	instance?: string;
	[extension: string]: unknown;
}

// What problemOf needs of the response. A Response is one; so is an HttpError.
interface ProblemSource {
	status: number;
	statusText?: string | null;
	headers?: { get(name: string): string | null } | null;
	mediaType?: string | null; // wins over headers
}

// The duck-typed shape getErrorMessage reads. HttpError is one; a foreign error class
// asserts it with `satisfies HttpErrorLike` through `import type` (no runtime dependency).
interface HttpErrorLike {
	message: string;
	status: number;
	body: unknown;
	problem?: { type: string; title: string; status: number; detail?: string };
	method?: string;
	url?: string;
}

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

Members of every `HttpError`:

```typescript
class HttpError extends Error {
	status: number;
	statusText: string;
	body: unknown; // parsed JSON, else text, else null
	get problem(): ProblemDetails; // problemOf(body, this); never undefined
	get type(): string; // problem.type; "about:blank" when the response named none
	method?: string; // own property, set only on errors an HttpApi method threw
	url?: string; // same; fully resolved, post-redirect
}
```

`instanceof` holds across installed copies of the package: every class in `HTTP_ERROR` is
registered on itself under `Symbol.for("@marianmeres/http-utils/error-kind")`, and
`HttpError[Symbol.hasInstance]` matches a foreign instance by that key along its prototype
chain. A user subclass has no key (plain `instanceof`). A 2.x copy has none either, so
2.x and 3.x errors do not recognize each other.

Every HTTP error thrown by an `HttpApi` method (non-2xx) also carries request context as
`cause` (exported as `HttpErrorCause`; `method`/`url` duplicate the typed members above,
the response headers are only here):

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
// Order: typed e.problem (type != "about:blank": detail, title) → e.cause.* → getBodyMessage(e.body)
//   → e.message → e.code → e.name → e.toString() → "Unknown Error".
// Strings (and numbers) only: never "[object Object]", never an HTML page.
function getErrorMessage(e: unknown, stripErrorPrefix?: boolean): string;
// The one sentence in a parsed body, or null. Order: problem detail (body has type+title)
//   → error.message → message → error.error_description → error.detail → detail → title
//   → error_description → errors[0] → error (string) → plain-text body (trimmed, cut at 500;
//   markup => null).
function getBodyMessage(body: unknown): string | null;
// The body as an RFC 9457 document. Problem if media type is application/problem+json, or
// the body names both type and title; otherwise "about:blank" with detail = getBodyMessage.
function problemOf(body: unknown, source: ProblemSource): ProblemDetails;
const PROBLEM_MEDIA_TYPE = "application/problem+json";
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
6. **Error message**: per-request extractor → per-instance → global → built-in
   (`getBodyMessage(body)`, cut at 255 chars); a throwing extractor falls through to the
   next one. An empty result becomes the status phrase (`response.statusText`, else the
   standard text for the status, else `HTTP <status>`), never `"Unknown error"`. So
   `error.message` and `getErrorMessage(error)` agree on what the server said
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
12. **Error request context**: HTTP errors carry `error.method` and `error.url` (fully
    resolved, query included; also on `cause`, whose `path` predates them and omits the
    query). Transport failures already name the URL in the message; HTTP errors do not
    (the message is the server's own), so `createHttpApi.global.appendUrlToErrorMessage`
    opts into appending it there too.
13. **Problem Details**: `error.problem` / `error.type` are derived from `body` on every
    access (plus the response's media type, kept in a module `WeakMap`), so they are never
    stale and never serialized. Branch on `type`, not on `status`.
14. **One class identity across copies**: see `instanceof` under Error Classes. Do not
    replace an `instanceof` with a `name` or `status` comparison to "fix" a multi-copy
    install; it already holds.

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
   `node:http` always sends a reason phrase, so a test that needs an empty `statusText`
   (what HTTP/2 delivers) replaces `globalThis.fetch` instead (`tests/problem.test.ts`).
   A second copy of the package is `import("../src/error.ts?copy=2")`: the specifier is a
   literal so Deno loads it without `--allow-read`, and `tests/second-copy.d.ts` declares
   it for tsc.

## Changes in 3.0 (for updating consumers)

| 2.x                                                                    | 3.0                                                                                       |
| ---------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| built-in message read `error.message`, `message`, `error`, else status | reads every `getBodyMessage` convention (RFC 9457 `detail`/`title`, plain-text body, ...) |
| nothing readable + empty `statusText` gave `"Unknown error"`           | the status phrase (`"Conflict"`)                                                          |
| `getErrorMessage` read `cause` before everything                       | a typed `problem` first; then `cause`, body, message                                      |
| `getErrorMessage` stringified any truthy member                        | strings/numbers only; markup bodies skipped; plain text cut at 500                        |
| request URL only on `cause.url`                                        | `error.url`, `error.method` (still on `cause`)                                            |
| `instanceof` failed across copies                                      | holds across 3.x copies (not between 2.x and 3.x)                                         |
| `defaultErrorMessageExtractor` per copy                                | shared across copies                                                                      |
| `HTTP_STATUS` 402/425 text ended in `" Experimental"`                  | `"Payment Required"`, `"Too Early"`                                                       |

A consumer that matches on `error.message` text is the one thing to check. A consumer
with its own subclass of an `HTTP_ERROR` class must not declare `problem`, `type`,
`method` or `url` with other types.

## Dependencies

- **Runtime**: None (zero dependencies)
- **Dev**: TypeScript, Biome, `@types/node` (testing uses `node:test` and `node:assert`)

## File Locations

| Purpose                 | Path                                           |
| ----------------------- | ---------------------------------------------- |
| Entry point             | `src/mod.ts`                                   |
| HttpApi implementation  | `src/api.ts`                                   |
| Error classes           | `src/error.ts`                                 |
| Body / problem reading  | `src/problem.ts`                               |
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
