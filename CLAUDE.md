# Claude Code Instructions

## Package Overview

**@marianmeres/http-utils** - Lightweight HTTP client wrapper for native `fetch` with type-safe errors.

## Key Concepts

- **createHttpApi(base?, defaults?, errorExtractor?)**: Factory function that creates an HttpApi instance
- **HttpApi**: Client with methods `get`, `post`, `put`, `patch`, `del`, `url`, `base`
- **HTTP_ERROR**: Namespace with error classes mapped to HTTP status codes (NotFound=404, etc.)
- **HTTP_STATUS**: Class with status code constants and `findByCode()` lookup

## File Structure

```
src/
├── mod.ts      # Public exports
├── api.ts      # HttpApi class, createHttpApi
├── error.ts    # HttpError classes, createHttpError, getErrorMessage
└── status.ts   # HTTP_STATUS codes
tests/
├── api.test.ts
├── new-api.test.ts
└── utils.test.ts
```

## Commands

```bash
deno task test      # Run tests
deno task publish   # Publish to JSR and NPM
```

## API Patterns

Two API styles supported:
1. **New Options API**: `api.get(path, { params, respHeaders, errorExtractor })`
2. **Legacy API**: `api.get(path, params, respHeaders, errorExtractor)`

## Error Handling

Errors thrown on non-OK responses (disable with `assert: false`). Error classes: BadRequest(400), Unauthorized(401), Forbidden(403), NotFound(404), InternalServerError(500), etc.

## See Also

- [README.md](README.md) - User documentation
- [API.md](API.md) - Complete API reference
- [AGENTS.md](AGENTS.md) - Machine-readable context
