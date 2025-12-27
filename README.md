# @marianmeres/http-utils

[![NPM version](https://img.shields.io/npm/v/@marianmeres/http-utils)](https://www.npmjs.com/package/@marianmeres/http-utils)
[![JSR version](https://jsr.io/badges/@marianmeres/http-utils)](https://jsr.io/@marianmeres/http-utils)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

Opinionated, lightweight HTTP client wrapper for `fetch` with type-safe errors and convenient defaults.

## Features

- 🎯 **Type-safe HTTP errors** - Well-known status codes map to specific error classes
- 🔧 **Convenient defaults** - Auto JSON parsing, Bearer tokens, base URLs
- 🪶 **Lightweight** - Zero dependencies, thin wrapper over native `fetch`
- 🎨 **Flexible error handling** - Three-tier error message extraction (local → factory → global)
- 📦 **Deno & Node.js** - Works in both runtimes

## Installation

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

## API Overview

### `createHttpApi(base?, defaults?, errorExtractor?)`

Creates an HTTP API client.

```ts
const api = createHttpApi("https://api.example.com", {
  headers: { "Authorization": "Bearer token" }
});
```

### HTTP Methods

```ts
// GET (new options API)
const data = await api.get("/users", {
  params: { headers: { "X-Custom": "value" } },
  respHeaders: {}
});

// POST/PUT/PATCH/DELETE (new options API)
await api.post("/users", {
  data: { name: "John" },
  params: { token: "bearer-token" }
});

// Legacy API still supported
const data = await api.get("/users", { headers: { "X-Custom": "value" } });
await api.post("/users", { name: "John" });
```

### Error Handling

```ts
import { HTTP_ERROR, NotFound } from "@marianmeres/http-utils";

try {
  await api.get("/resource");
} catch (error) {
  if (error instanceof NotFound) {
    console.log("Not found:", error.body);
  }
  // All errors have: status, statusText, body, cause
}
```

### Key Features

- **Auto JSON**: Response bodies are automatically parsed as JSON
- **Bearer tokens**: Use `token` param to auto-add `Authorization: Bearer` header
- **Response headers**: Pass `respHeaders: {}` to capture response headers
- **Raw response**: Use `raw: true` to get the raw Response object
- **Non-throwing**: Use `assert: false` to prevent throwing on errors
- **AbortController**: Pass `signal` for request cancellation

## Full API Reference

For complete API documentation including all error classes, HTTP status codes, types, and utilities, see **[API.md](API.md)**.

## Utilities

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