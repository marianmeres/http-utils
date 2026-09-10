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
	createHttpApi,
	type DataOptions,
	type ErrorMessageExtractor,
	type ErrorUrlFormatter,
	fetchOrThrow,
	type FetchOrThrowGlobalOptions,
	type FetchOrThrowOptions,
	type FetchParams,
	type GetOptions,
	HttpApi,
	type HttpApiGlobalOptions,
	type HttpErrorCause,
	opts,
	type QueryValue,
	type RequestData,
	type RequestInterceptor,
	type ResponseHeaders,
	type ResponseInterceptor,
} from "./api.ts";
export { createHttpError, getErrorMessage, HTTP_ERROR } from "./error.ts";
export { HTTP_STATUS } from "./status.ts";
