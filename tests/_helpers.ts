export const hostname = "127.0.0.1";

export const CUSTOM_ERR_MSG = "this is custom error";

// Helper to find available port
export async function getAvailablePort(): Promise<number> {
	const listener = Deno.listen({ hostname, port: 0 });
	const port = (listener.addr as Deno.NetAddr).port;
	listener.close();
	return port;
}
