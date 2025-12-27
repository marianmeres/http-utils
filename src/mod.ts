/**
 * @module http-utils
 *
 * Opinionated, lightweight HTTP client wrapper for the native `fetch` API.
 * Provides type-safe HTTP errors, convenient defaults, and flexible error handling.
 *
 * @example
 * ```ts
 * import { createHttpApi, HTTP_ERROR, HTTP_STATUS } from "@marianmeres/http-utils";
 *
 * const api = createHttpApi("https://api.example.com", {
 *   headers: { "Authorization": "Bearer token" }
 * });
 *
 * try {
 *   const users = await api.get("/users");
 * } catch (error) {
 *   if (error instanceof HTTP_ERROR.NotFound) {
 *     console.log("Not found:", error.body);
 *   }
 * }
 * ```
 */

export {
	HttpApi,
	createHttpApi,
	type DataOptions,
	type GetOptions,
	type FetchParams,
	type ErrorMessageExtractor,
	type ResponseHeaders,
	type RequestData,
} from "./api.ts";
export { HTTP_ERROR, createHttpError, getErrorMessage } from "./error.ts";
export { HTTP_STATUS } from "./status.ts";
