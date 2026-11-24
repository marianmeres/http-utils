import { createServer, type IncomingMessage } from "node:http";
import { createServer as createNetServer } from "node:net";

export const hostname = "127.0.0.1";

export const CUSTOM_ERR_MSG = "this is custom error";

/**
 * Finds a free port. Only for a port that must stay closed (a guaranteed connection
 * failure): a test server binds port 0 through `serve` and reads the port it got.
 */
export function getAvailablePort(): Promise<number> {
	return new Promise((resolve, reject) => {
		const probe = createNetServer();
		probe.once("error", reject);
		probe.listen(0, hostname, () => {
			const addr = probe.address();
			const port = addr && typeof addr === "object" ? addr.port : 0;
			probe.close(() => resolve(port));
		});
	});
}

/** A running test server from `serve`. */
export interface TestServer {
	/** The bound port, the OS-assigned one when `serve` was given port 0. */
	readonly port: number;
	/** Closes the listener and every open connection; resolves once it is closed. */
	shutdown(): Promise<void>;
}

// The request body as a web stream, built by hand: `Readable.toWeb(incoming)` destroys
// the socket when a handler cancels the body, so the client would see a reset.
function requestBody(incoming: IncomingMessage): ReadableStream<Uint8Array> {
	const chunks = incoming[Symbol.asyncIterator]();
	return new ReadableStream<Uint8Array>({
		async pull(controller) {
			const { done, value } = await chunks.next();
			if (done) controller.close();
			else controller.enqueue(new Uint8Array(value));
		},
		cancel() {
			incoming.resume();
		},
	});
}

/**
 * A web-standard test server over `node:http`: `Request => Response` handlers, the
 * shape `Deno.serve` had, so the handlers stay as written and the suite runs on Node
 * and on Deno alike. Resolves once the server listens.
 *
 * `req.signal` aborts when the client goes away. An empty `statusText` leaves Node's
 * standard reason phrase in place, as `Deno.serve` did.
 */
export function serve(
	options: { hostname?: string; port?: number },
	handler: (req: Request) => Response | Promise<Response>,
): Promise<TestServer> {
	const server = createServer(async (incoming, outgoing) => {
		outgoing.on("error", () => {});
		const gone = new AbortController();
		outgoing.on("close", () => {
			if (!outgoing.writableFinished) gone.abort();
		});
		const headers = new Headers();
		for (const [k, v] of Object.entries(incoming.headers)) {
			if (v !== undefined) headers.set(k, Array.isArray(v) ? v.join(", ") : v);
		}
		const hasBody = incoming.method !== "GET" && incoming.method !== "HEAD";
		let response: Response;
		try {
			const req = new Request(`http://${incoming.headers.host}${incoming.url}`, {
				method: incoming.method,
				headers,
				signal: gone.signal,
				...(hasBody ? { body: requestBody(incoming), duplex: "half" } : {}),
			} as RequestInit);
			response = await handler(req);
		} catch {
			response = new Response("Internal Server Error", { status: 500 });
		}
		if (outgoing.destroyed) return;
		outgoing.statusCode = response.status;
		if (response.statusText) outgoing.statusMessage = response.statusText;
		for (const [k, v] of response.headers) outgoing.setHeader(k, v);
		try {
			if (response.body) {
				for await (const chunk of response.body) {
					if (outgoing.destroyed) break;
					outgoing.write(chunk);
				}
			}
		} catch {
			// the client went away mid-response
		}
		outgoing.end();
	});

	return new Promise((resolve, reject) => {
		server.once("error", reject);
		server.listen(options.port ?? 0, options.hostname ?? hostname, () => {
			const addr = server.address();
			const port = addr && typeof addr === "object" ? addr.port : 0;
			resolve({
				port,
				shutdown: () =>
					new Promise<void>((done) => {
						server.close(() => done());
						server.closeAllConnections();
					}),
			});
		});
	});
}
