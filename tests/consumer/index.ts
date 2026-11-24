// Compiled by `pnpm run typecheck:consumer` only (see tsconfig.json here); never run.
//
// Guards the published declarations of the two expando functions. tsc 7 emits their
// properties as `declare namespace` members, and in an ambient namespace with any
// explicit `export`, a member without one is not exported: from a bare
// `createHttpApi.global = _HTTPAPI_GLOBAL;` it emitted `export { _HTTPAPI_GLOBAL as
// global }` beside a plain `var defaultErrorMessageExtractor`, which then vanished from
// the npm types. The `as HttpApiGlobalOptions` / `as FetchOrThrowGlobalOptions` on those
// assignments in src/api.ts are what keep every member exported (type-only, erased).
import {
	createHttpApi,
	type ErrorMessageExtractor,
	type FetchOrThrowGlobalOptions,
	fetchOrThrow,
	getBodyMessage,
	getErrorMessage,
	HTTP_ERROR,
	HTTP_STATUS,
	type HttpApiGlobalOptions,
	type HttpErrorCause,
	type HttpErrorLike,
	opts,
	PROBLEM_MEDIA_TYPE,
	type ProblemDetails,
	type ProblemSource,
	problemOf,
} from "@marianmeres/http-utils";

// fetchOrThrow.global
const fotGlobal: FetchOrThrowGlobalOptions = fetchOrThrow.global;
fetchOrThrow.global.onRequest = ({ method, url }) => console.debug(method, url);
fetchOrThrow.global.onError = undefined;

// createHttpApi.global + createHttpApi.defaultErrorMessageExtractor
const apiGlobal: HttpApiGlobalOptions = createHttpApi.global;
createHttpApi.global.appendUrlToErrorMessage = true;
createHttpApi.global.appendUrlToErrorMessage = ({ method, url }) => `${method} ${url}`;
const extractor: ErrorMessageExtractor = (body) => String(body);
createHttpApi.defaultErrorMessageExtractor = extractor;
createHttpApi.defaultErrorMessageExtractor = null;

// the client, errors and status codes
const api = createHttpApi("https://example.com", { headers: { a: "b" } });
const user = await api.get<{ id: string }>("/user", opts({ params: { timeout: 10 } }));
const id: string = user.id;
const notFound = new HTTP_ERROR.NotFound("gone");
const status: number = notFound.status;
const cause = notFound.cause as HttpErrorCause | undefined;
// findByCode takes a string too (it compares with ==)
const text: string | undefined = HTTP_STATUS.findByCode("404")?.TEXT;

// Problem Details: the typed members of an error, and the two readers
const problem: ProblemDetails = notFound.problem;
const type: string = notFound.type;
const requested: [string | undefined, string | undefined] = [
	notFound.method,
	notFound.url,
];
const source: ProblemSource = { status: 409, mediaType: PROBLEM_MEDIA_TYPE };
const read: ProblemDetails = problemOf({ title: "Conflict" }, source);
const fromResponse: ProblemDetails = problemOf("{}", new Response(null, { status: 500 }));
const sentence: string | null = getBodyMessage({ detail: "x" });

// HttpErrorLike: this package's own error is one, and so is a class written without
// it (a refusal keyed by its problem type, with its own narrower problem type)
interface OwnProblem {
	type: string;
	title: string;
	status: number;
	detail?: string;
	code?: string;
}
class ApiError extends Error {
	readonly status: number = 409;
	readonly body: unknown = null;
	readonly problem: OwnProblem = { type: "urn:x", title: "Conflict", status: 409 };
	readonly method: string = "GET";
	readonly url: string = "/x";
}
const likeOwn: HttpErrorLike = notFound;
const likeTheirs = new ApiError("x") satisfies HttpErrorLike;
const message: string = getErrorMessage(likeTheirs);

export {
	apiGlobal,
	cause,
	fotGlobal,
	fromResponse,
	id,
	likeOwn,
	message,
	problem,
	read,
	requested,
	sentence,
	status,
	text,
	type,
};
