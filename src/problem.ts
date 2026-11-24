/**
 * @module problem
 *
 * Reading what a failed response says: the one sentence in its body
 * ({@link getBodyMessage}), and the body as an RFC 9457 Problem Details document
 * ({@link problemOf}). Both are pure functions over an already parsed body, and both
 * are what the rest of the package reads errors with: the `HttpApi` client builds an
 * error's `message` from the first, `HttpError.problem` is the second, and
 * `getErrorMessage` goes through both.
 */

import { HTTP_STATUS } from "./status.ts";

/** RFC 9457's media type. */
export const PROBLEM_MEDIA_TYPE = "application/problem+json";

/** RFC 9457's `type` for a problem with no meaning beyond its status. */
export const ABOUT_BLANK = "about:blank";

/** The longest plain-text body carried as a message (a page of text is not one). */
const TEXT_MAX = 500;

/**
 * An RFC 9457 Problem Details document, as {@link problemOf} returns it: the three
 * members a reader needs are always there, filled in from the response when the
 * producer left them out.
 *
 * `type` is the stable identity of the problem and the member to branch on. The status
 * groups unrelated refusals under one number, and `title` / `detail` are prose a
 * producer is free to reword. Extension members a producer added (a list of field
 * errors, a machine-readable code) are kept as they came.
 */
export interface ProblemDetails {
	/** A URI identifying the problem type, or `"about:blank"` when there is none. */
	type: string;
	/** Short summary of the type; the HTTP status phrase for `"about:blank"`. */
	title: string;
	/** The HTTP status. */
	status: number;
	/** What went wrong this time. */
	detail?: string;
	/** A URI reference identifying this occurrence. */
	instance?: string;
	/** Extension members. */
	[extension: string]: unknown;
}

/**
 * What {@link problemOf} needs to know about the response a body came with. A
 * `Response` is one, and so is an `HttpError`.
 */
export interface ProblemSource {
	/** The HTTP status. */
	status: number;
	/** The reason phrase; the standard one for the status is used when it is empty. */
	statusText?: string | null;
	/** The response headers, read for `content-type`. */
	headers?: { get(name: string): string | null } | null;
	/** The media type, when there are no `headers` to read it from. Wins over them. */
	mediaType?: string | null;
}

/** JSON text as its value; anything else (and text that is not JSON) as it is. */
export function maybeJsonParse(value: unknown): unknown {
	if (typeof value === "string") {
		try {
			return JSON.parse(value);
		} catch (_e) {
			// not JSON: the text is the value
		}
	}
	return value;
}

/** A non-array object, as a record to read members off. */
export function recordOf(value: unknown): Record<string, unknown> | undefined {
	return value !== null && typeof value === "object" && !Array.isArray(value)
		? (value as Record<string, unknown>)
		: undefined;
}

/**
 * A value that can stand as a message: a string that is not blank, or a number (a
 * numeric error code). Everything else is `undefined`, so an object or an array found
 * where a sentence was expected is skipped instead of becoming `"[object Object]"`.
 */
export function textOf(value: unknown): string | undefined {
	if (typeof value === "string") return value.trim() === "" ? undefined : value;
	if (typeof value === "number" && Number.isFinite(value) && value !== 0) {
		return String(value);
	}
	return undefined;
}

/** A string that is not blank, as it is; `undefined` for anything else. */
function stringOf(value: unknown): string | undefined {
	return typeof value === "string" && value.trim() !== "" ? value : undefined;
}

/**
 * A plain-text body as a message. Markup is not one: an HTML page is what a proxy
 * or a misrouted request answers with, and its source says nothing to a reader.
 */
function plainTextOf(value: string): string | undefined {
	const text = value.trim();
	if (text === "" || text.startsWith("<")) return undefined;
	return text.length > TEXT_MAX ? `${text.slice(0, TEXT_MAX)}…` : text;
}

/** `"application/problem+json"` out of `"application/problem+json; charset=utf-8"`. */
function mediaTypeOf(source: ProblemSource): string {
	const value = source.mediaType ?? source.headers?.get("content-type") ?? "";
	return (value.split(";")[0] ?? "").trim().toLowerCase();
}

/** The reason phrase of a response, or the standard one for its status. */
export function statusTextOf(source: {
	status: number;
	statusText?: string | null;
}): string {
	return (
		textOf(source.statusText) ??
		HTTP_STATUS.findByCode(source.status)?.TEXT ??
		`HTTP ${source.status}`
	);
}

/**
 * Extracts the one human-readable sentence a response body carries, or `null` when it
 * carries none.
 *
 * Understands the common conventions, in this order:
 *
 * 1. `detail` of an RFC 9457 problem document (a body naming both `type` and `title`)
 * 2. `error.message`, `message`
 * 3. `error.error_description`, `error.detail`
 * 4. `detail`, `title` (RFC 9457 / DRF / FastAPI)
 * 5. `error_description` (OAuth 2)
 * 6. `errors[0]` (JSON:API; a string, or the entry's `detail` / `title` / `message`)
 * 7. `error` (a string)
 * 8. the body itself, when it is plain text
 *
 * Only a non-blank string (or a number) counts: a member that holds an object or an
 * array is skipped. A plain-text body is trimmed and cut at 500 characters, and one
 * that is markup (an HTML error page) is not a message at all. JSON text is parsed
 * first, so a body may be passed as received.
 *
 * This is the reading the `HttpApi` client builds an error's `message` from, and the
 * body part of {@link getErrorMessage}. Use it in an `ErrorMessageExtractor` of your
 * own to decorate the result instead of replacing it.
 *
 * @example
 * ```ts
 * getBodyMessage({ type: "urn:example:conflict", title: "Conflict", detail: "Stale version." });
 * // "Stale version."
 * getBodyMessage({ error: { message: "Invalid token" } }); // "Invalid token"
 * getBodyMessage("<html>…</html>"); // null
 * ```
 */
export function getBodyMessage(body: unknown): string | null {
	const parsed = maybeJsonParse(body);
	if (typeof parsed === "string") return plainTextOf(parsed) ?? null;

	const b = recordOf(parsed);
	if (!b) return null;

	const error = recordOf(b.error);
	const first: unknown = Array.isArray(b.errors) ? b.errors[0] : undefined;
	const firstRecord = recordOf(first);
	const isProblem = typeof b.type === "string" && typeof b.title === "string";

	return (
		// a problem document says it in `detail`, whatever else it carries
		(isProblem ? textOf(b.detail) : undefined) ??
		textOf(error?.message) ??
		textOf(b.message) ??
		// nested under `error` (OAuth-style, RFC 9457-style)
		textOf(error?.error_description) ??
		textOf(error?.detail) ??
		// RFC 9457 (Problem Details) / DRF / FastAPI
		textOf(b.detail) ??
		textOf(b.title) ??
		// OAuth 2 (RFC 6749): before `error`, so the description wins over the code
		textOf(b.error_description) ??
		// JSON:API / generic errors[]
		(typeof first === "string"
			? textOf(first)
			: (textOf(firstRecord?.detail) ??
				textOf(firstRecord?.title) ??
				textOf(firstRecord?.message))) ??
		// `error` as a plain string (an OAuth error code without a description)
		textOf(b.error) ??
		null
	);
}

/**
 * Reads a response body as an RFC 9457 Problem Details document.
 *
 * A body is a problem document when it was served as `application/problem+json`, or
 * when it is a JSON object naming both a `type` and a `title` under any media type.
 * Its members are kept as they came, and the three required ones are completed the
 * way RFC 9457 reads an absence: `type` as `"about:blank"`, `status` as the
 * response's, `title` as its reason phrase. A `detail` that is not a string is
 * dropped.
 *
 * Any other body (plain text, another JSON shape, an HTML page, nothing) is the
 * `"about:blank"` problem: the status is the whole meaning, and the body's own
 * sentence ({@link getBodyMessage}), when it has one, is the `detail`.
 *
 * So the result always has a `type` to branch on, and never throws.
 *
 * @param body - The response body, parsed or as text.
 * @param source - The response it came with (a `Response`, or its status and media type).
 *
 * @example
 * ```ts
 * const response = await fetch(url);
 * if (!response.ok) {
 *   const problem = problemOf(await response.text(), response);
 *   if (problem.type === "urn:example:error:conflict") { ... }
 * }
 * ```
 */
export function problemOf(body: unknown, source: ProblemSource): ProblemDetails {
	const parsed = maybeJsonParse(body);
	const record = recordOf(parsed);
	const status = source.status;
	const title = statusTextOf(source);

	const isProblem =
		record !== undefined &&
		(mediaTypeOf(source) === PROBLEM_MEDIA_TYPE ||
			(typeof record.type === "string" && typeof record.title === "string"));

	if (!isProblem) {
		const detail = getBodyMessage(parsed);
		return {
			type: ABOUT_BLANK,
			title,
			status,
			...(detail === null ? {} : { detail }),
		};
	}

	const document: Record<string, unknown> = { ...record };
	// A member of the wrong type is not that member; dropping it keeps the document
	// readable as typed (a `detail` that is an object is not a sentence).
	if (typeof document.detail !== "string") delete document.detail;
	if (typeof document.instance !== "string") delete document.instance;

	return {
		...document,
		type: stringOf(record.type) ?? ABOUT_BLANK,
		title: stringOf(record.title) ?? title,
		status: typeof record.status === "number" ? record.status : status,
	};
}
