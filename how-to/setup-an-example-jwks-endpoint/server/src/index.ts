import cors from "cors";
import express, { type Request, type Response } from "express";

import {
	getHmacSecret,
	getHmacSecretSource,
	getJwks,
	initHmacSecret,
	refreshHmacSecret,
	signJwt,
	signJwtHmac,
	verifyJwt,
	type IssueTokenOptions,
	type SigningAlgorithm
} from "./keys.js";

const app = express();
const port = process.env.PORT !== undefined ? Number(process.env.PORT) : 6061;

// Trust the reverse proxy (e.g. ngrok) so req.protocol reflects X-Forwarded-Proto (https)
// rather than the plain http connection the tunnel makes to this process.
app.set("trust proxy", true);

// JWKS endpoints are meant to be publicly reachable, and this also lets the server be
// called cross-origin from any tunnelled address (e.g. an ngrok URL) without extra config.
app.use(cors());
app.use(express.json());
app.use(express.static("public"));

/**
 * Read a value that may be a string, the first entry of a string array, or absent.
 * @param value The raw value pulled from a query string or JSON body.
 * @returns The value as a string, or undefined if it isn't a usable string.
 */
function asString(value: unknown): string | undefined {
	if (typeof value === "string" && value.length > 0) {
		return value;
	}
	if (Array.isArray(value) && typeof value[0] === "string") {
		return value[0];
	}
	return undefined;
}

/**
 * Determine the externally visible origin of a request, honouring the proxy headers added by
 * tunnels such as ngrok so the value is usable by whoever called us.
 * @param req The incoming Express request.
 * @returns The origin, e.g. https://example.ngrok-free.app.
 */
function getRequestOrigin(req: Request): string {
	return `${req.protocol}://${req.get("host") ?? ""}`;
}

/**
 * Build the token issuance options from either the query string (GET) or the JSON body (POST),
 * defaulting the issuer to the requesting origin so it is correct whether the server is
 * reached via localhost or a tunnelled address such as an ngrok URL.
 * @param req The incoming Express request.
 * @returns The chosen signing algorithm and the options to pass to the matching sign function.
 */
function getIssueTokenOptions(req: Request): {
	/**
	 * The algorithm the caller asked for, defaulting to RS256.
	 */
	algorithm: SigningAlgorithm;
	/**
	 * The claims and expiry to sign.
	 */
	options: IssueTokenOptions;
} {
	const source = (req.method === "GET" ? req.query : req.body) as { [key: string]: unknown } | undefined;
	const { sub, aud, issuer, expiresIn, algorithm, ...claims } = source ?? {};

	return {
		algorithm: asString(algorithm)?.toUpperCase() === "HS256" ? "HS256" : "RS256",
		options: {
			sub: asString(sub),
			aud: asString(aud),
			issuer: asString(issuer) ?? getRequestOrigin(req),
			expiresIn: asString(expiresIn),
			claims
		}
	};
}

app.get("/.well-known/jwks.json", async (req: Request, res: Response) => {
	const jwks = await getJwks();
	res.status(200).json(jwks);
});

// Real identity providers (Entra, Keycloak, ...) publish this document so clients can discover
// the issuer and JWKS URI rather than having them hardcoded. Serving one lets anything that
// expects OIDC discovery point at this server unchanged.
app.get("/.well-known/openid-configuration", (req: Request, res: Response) => {
	const origin = getRequestOrigin(req);

	/* eslint-disable camelcase -- these member names are fixed by the OpenID Connect Discovery spec */
	res.status(200).json({
		issuer: origin,
		jwks_uri: `${origin}/.well-known/jwks.json`,
		token_endpoint: `${origin}/api/token`,
		id_token_signing_alg_values_supported: ["RS256", "HS256"],
		response_types_supported: ["token"],
		subject_types_supported: ["public"],
		claims_supported: ["iss", "aud", "sub", "exp", "iat", "preferred_username"]
	});
	/* eslint-enable camelcase */
});

/**
 * Issue a new JWT based on the request's query string or JSON body, signed either with this
 * server's private key (RS256) or with the shared secret (HS256).
 * @param req The incoming Express request.
 * @param res The Express response.
 */
async function issueToken(req: Request, res: Response): Promise<void> {
	try {
		const { algorithm, options } = getIssueTokenOptions(req);
		const issuedToken = algorithm === "HS256" ? await signJwtHmac(options) : await signJwt(options);
		res.status(200).json(issuedToken);
	} catch (error) {
		console.error("Failed to issue token", error);
		res.status(500).json({ error: "Failed to issue token" });
	}
}

app.get("/api/token", issueToken);
app.post("/api/token", issueToken);

app.get("/api/secret", (req: Request, res: Response) => {
	res.status(200).json({ secret: getHmacSecret(), source: getHmacSecretSource() });
});

app.post("/api/secret/refresh", async (req: Request, res: Response) => {
	try {
		const secret = await refreshHmacSecret();
		console.log("Shared secret refreshed. Any token issued with the previous secret is now invalid.");
		res.status(200).json({ secret, source: getHmacSecretSource() });
	} catch (error) {
		res.status(400).json({
			error: error instanceof Error ? error.message : "Failed to refresh the shared secret"
		});
	}
});

app.post("/api/verify", async (req: Request, res: Response) => {
	const token = asString((req.body as { [key: string]: unknown } | undefined)?.token);
	if (token === undefined) {
		res.status(400).json({ error: "A 'token' field is required in the request body" });
		return;
	}

	try {
		const { payload, protectedHeader } = await verifyJwt(token);
		res.status(200).json({ valid: true, header: protectedHeader, payload });
	} catch (error) {
		res
			.status(401)
			.json({ valid: false, error: error instanceof Error ? error.message : "Verification failed" });
	}
});

// The shared secret has to be loaded (or created) before the first token can be signed with it.
await initHmacSecret();

app.listen(port, () => {
	const baseUrl = `http://localhost:${port}`;
	const secretSource =
		getHmacSecretSource() === "env"
			? "from the HMAC_SECRET environment variable"
			: "persisted to .hmac-secret";
	console.log(`JWKS example server is running on ${baseUrl}`);
	console.log(`JWKS endpoint: ${baseUrl}/.well-known/jwks.json`);
	console.log(`OIDC discovery: ${baseUrl}/.well-known/openid-configuration`);
	console.log(`Issue a token: curl "${baseUrl}/api/token?sub=demo-user&aud=my-app"`);
	console.log(`Issue an HS256 token: curl "${baseUrl}/api/token?sub=demo-user&aud=my-app&algorithm=HS256"`);
	console.log(
		`Verify a token: curl -X POST ${baseUrl}/api/verify -H "Content-Type: application/json" -d "{\\"token\\":\\"...\\"}"`
	);
	console.log(`Shared secret (${secretSource}): ${getHmacSecret()}`);
	console.log(`To reach this server from another machine, run: ngrok http ${port}`);
});
