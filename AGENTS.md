# AGENTS.md - Machine-Readable Package Context

## Package Identity

```yaml
name: "@marianmeres/http-utils"
version: "2.0.2"
license: MIT
runtime: deno, node
type: library
category: http-client
```

## Purpose

Lightweight, opinionated HTTP client wrapper for the native `fetch` API. Provides type-safe HTTP errors mapped to specific error classes (e.g., 404 → NotFound), convenient defaults (auto JSON parsing, Bearer token support, base URLs), and flexible three-tier error message extraction.

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
  factoryErrorMessageExtractor?: ErrorMessageExtractor | null
): HttpApi
```

### HttpApi Methods

| Method | Signature | Description |
|--------|-----------|-------------|
| `get` | `get(path, options?: GetOptions): Promise<unknown>` | GET request |
| `post` | `post(path, options?: DataOptions): Promise<unknown>` | POST request |
| `put` | `put(path, options?: DataOptions): Promise<unknown>` | PUT request |
| `patch` | `patch(path, options?: DataOptions): Promise<unknown>` | PATCH request |
| `del` | `del(path, options?: DataOptions): Promise<unknown>` | DELETE request |
| `url` | `url(path: string): string` | Build full URL |
| `base` | `get/set base: string \| null` | Base URL property |

### Exported Types

```typescript
type RequestData = Record<string, unknown> | FormData | string | null;

interface FetchParams {
  data?: RequestData;
  token?: string | null;
  headers?: Record<string, string> | null;
  signal?: AbortSignal;
  credentials?: 'omit' | 'same-origin' | 'include' | null;
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
```

### Error Classes (HTTP_ERROR namespace)

```typescript
HTTP_ERROR.HttpError        // Base class (default 500)
HTTP_ERROR.BadRequest       // 400
HTTP_ERROR.Unauthorized     // 401
HTTP_ERROR.Forbidden        // 403
HTTP_ERROR.NotFound         // 404
HTTP_ERROR.MethodNotAllowed // 405
HTTP_ERROR.RequestTimeout   // 408
HTTP_ERROR.Conflict         // 409
HTTP_ERROR.Gone             // 410
HTTP_ERROR.LengthRequired   // 411
HTTP_ERROR.ImATeapot        // 418
HTTP_ERROR.UnprocessableContent // 422
HTTP_ERROR.TooManyRequests  // 429
HTTP_ERROR.InternalServerError // 500
HTTP_ERROR.NotImplemented   // 501
HTTP_ERROR.BadGateway       // 502
HTTP_ERROR.ServiceUnavailable // 503
```

### Utility Functions

```typescript
function createHttpError(code: number | string, message?: string | null, body?: unknown, cause?: unknown): HttpError
function getErrorMessage(e: unknown, stripErrorPrefix?: boolean): string
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

1. **Auto JSON parsing**: Response bodies are automatically parsed as JSON if possible
2. **Bearer token**: `token` param auto-adds `Authorization: Bearer {token}` header
3. **Error throwing**: By default, non-OK responses throw HttpError (disable with `assert: false`)
4. **Response headers**: Pass `respHeaders: {}` to capture response headers (mutated in place)
5. **Raw response**: Use `raw: true` to get raw Response object instead of parsed body
6. **Error priority**: per-request extractor → per-instance → global → built-in fallback

## Development Commands

```bash
deno task test        # Run tests
deno task test:watch  # Run tests in watch mode
deno task npm:build   # Build for NPM
deno task publish     # Publish to JSR and NPM
```

## Dependencies

- **Runtime**: None (zero dependencies)
- **Dev**: @std/assert (testing)

## File Locations

| Purpose | Path |
|---------|------|
| Entry point | `src/mod.ts` |
| HttpApi implementation | `src/api.ts` |
| Error classes | `src/error.ts` |
| Status codes | `src/status.ts` |
| Tests | `tests/*.test.ts` |
| NPM output | `.npm-dist/` |

## Common Patterns

### Basic Usage

```typescript
const api = createHttpApi("https://api.example.com", {
  headers: { "Authorization": "Bearer token" }
});

const data = await api.get("/users");
await api.post("/users", { data: { name: "John" } });
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
  headers: { "Authorization": `Bearer ${await getToken()}` }
}));
```
