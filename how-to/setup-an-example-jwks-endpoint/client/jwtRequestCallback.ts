/**
 * Reference implementation of a synchronous jwtRequestCallback (matching the shape that
 * `jwtAuthenticationParameters.jwtRequestCallback` from the `@openfin/cloud-interop` package
 * expects, and similar sync callback based auth integrations) that is backed by the
 * setup-an-example-jwks-endpoint server instead of a locally signed, shared-secret JWT.
 *
 * This file is a standalone, copy-pasteable sample. It is not compiled as part of the server
 * build; copy it into whichever app needs to supply a jwtRequestCallback and adjust the options
 * (or the AUTHENTICATION_* / JWKS_EXAMPLE_TOKEN_ENDPOINT environment variables it reads) as
 * needed. It requires Node 18+ for the global fetch API.
 *
 * Usage:
 *
 * ```ts
 * const jwtRequestCallback = await createJwtRequestCallback();
 *
 * const cloudConfig = {
 *   ...
 *   authenticationType: "jwt",
 *   jwtAuthenticationParameters: {
 *     authenticationId: "...",
 *     jwtRequestCallback
 *   }
 * };
 * ```
 */

const DEFAULT_TOKEN_ENDPOINT = "http://localhost:6061/api/token";
const DEFAULT_REFRESH_BUFFER_RATIO = 0.8;
const FALLBACK_EXPIRY_MS = 3_600_000;
const NGROK_HOSTNAME_PATTERN = /\.ngrok(-free)?\.(app|io)$/iu;
const EXPIRES_IN_PATTERN = /^(\d+)\s*(s|m|h|d)?$/iu;
const MS_PER_UNIT: { [key: string]: number } = { s: 1000, m: 60_000, h: 3_600_000, d: 86_400_000 };

/**
 *
 */
export interface JwtRequestCallbackOptions {
	/**
	 *
	 */
	tokenEndpoint?: string;
	/**
	 *
	 */
	sub?: string;
	/**
	 *
	 */
	aud?: string;
	/**
	 *
	 */
	issuer?: string;
	/**
	 *
	 */
	preferredUsername?: string;
	/**
	 *
	 */
	claims?: { [key: string]: unknown };
	/**
	 *
	 */
	expiresIn?: string;
	/**
	 *
	 */
	headers?: { [key: string]: string };
	/**
	 *
	 */
	refreshBufferRatio?: number;
}

/**
 *
 */
interface TokenResponse {
	/**
	 *
	 */
	token: string;
	/**
	 *
	 */
	expiresIn: string | number;
}

/**
 * Build the headers used to call the token endpoint, automatically adding the header needed to
 * skip ngrok's free-tier browser-warning interstitial page when the endpoint looks like an
 * ngrok host, so callers don't need to know about that quirk.
 * @param tokenEndpoint The URL of the /api/token endpoint being called.
 * @param extraHeaders Additional headers supplied by the caller.
 * @returns The headers to send with the token request.
 */
function buildRequestHeaders(
	tokenEndpoint: string,
	extraHeaders?: { [key: string]: string }
): { [key: string]: string } {
	const headers: { [key: string]: string } = { "Content-Type": "application/json", ...extraHeaders };

	try {
		const { hostname } = new URL(tokenEndpoint);
		if (NGROK_HOSTNAME_PATTERN.test(hostname) && headers["ngrok-skip-browser-warning"] === undefined) {
			headers["ngrok-skip-browser-warning"] = "true";
		}
	} catch {
		// Let fetch surface an invalid tokenEndpoint URL rather than failing here.
	}

	return headers;
}

/**
 * Resolve an "expiresIn" value (as returned by the token endpoint) to a duration in milliseconds.
 * @param expiresIn A duration such as "1h", "3600" or a raw number of seconds.
 * @returns The equivalent duration in milliseconds.
 */
function resolveExpiryMs(expiresIn: string | number): number {
	if (typeof expiresIn === "number") {
		return expiresIn * 1000;
	}

	const match = EXPIRES_IN_PATTERN.exec(expiresIn.trim());
	if (match?.[1] !== undefined) {
		const amount = Number(match[1]);
		const unit = match[2]?.toLowerCase() ?? "s";
		return amount * (MS_PER_UNIT[unit] ?? 1000);
	}

	return FALLBACK_EXPIRY_MS;
}

/**
 * Create a synchronous jwtRequestCallback backed by the setup-an-example-jwks-endpoint server.
 *
 * Since fetching a token over HTTP is inherently asynchronous but callbacks such as
 * jwtAuthenticationParameters.jwtRequestCallback must be synchronous, this fetches a token up
 * front, schedules a background refresh before it expires, and returns a plain function that
 * always returns the most recently cached token.
 * @param options Claims, endpoint and header overrides for the issued token.
 * @returns A synchronous function that returns the current cached JWT.
 */
export async function createJwtRequestCallback(
	options: JwtRequestCallbackOptions = {}
): Promise<() => string> {
	const tokenEndpoint =
		options.tokenEndpoint ?? process.env.JWKS_EXAMPLE_TOKEN_ENDPOINT ?? DEFAULT_TOKEN_ENDPOINT;
	const refreshBufferRatio = options.refreshBufferRatio ?? DEFAULT_REFRESH_BUFFER_RATIO;
	const requestBody = {
		sub: options.sub ?? process.env.AUTHENTICATION_PREFERRED_SUB,
		aud: options.aud ?? process.env.AUTHENTICATION_AUDIENCE,
		issuer: options.issuer ?? process.env.AUTHENTICATION_ISSUER,
		// eslint-disable-next-line camelcase -- this is a standard OIDC claim name and must stay snake_case
		preferred_username: options.preferredUsername ?? process.env.AUTHENTICATION_PREFERRED_USERNAME,
		...options.claims
	};

	let cachedToken = "";
	let refreshTimer: ReturnType<typeof setTimeout> | undefined;

	/**
	 * Fetch a fresh token from the server and schedule the next background refresh.
	 */
	async function fetchToken(): Promise<void> {
		const response = await fetch(tokenEndpoint, {
			method: "POST",
			headers: buildRequestHeaders(tokenEndpoint, options.headers),
			body: JSON.stringify(requestBody)
		});

		if (!response.ok) {
			throw new Error(`Failed to fetch JWT from ${tokenEndpoint}: ${response.status} ${response.statusText}`);
		}

		const data = (await response.json()) as TokenResponse;
		cachedToken = data.token;

		if (refreshTimer !== undefined) {
			clearTimeout(refreshTimer);
		}
		refreshTimer = setTimeout(
			() => {
				fetchToken().catch((error: unknown) => {
					console.error("Failed to refresh JWT, keeping previous token until next attempt", error);
				});
			},
			resolveExpiryMs(data.expiresIn) * refreshBufferRatio
		);
		refreshTimer.unref?.();
	}

	await fetchToken();

	return () => cachedToken;
}
