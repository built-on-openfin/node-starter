import cors from "cors";
import express, { type Request, type Response } from "express";

import { getJwks, signJwt, verifyJwt, type IssueTokenOptions } from "./keys.js";

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
 * Build the token issuance options from either the query string (GET) or the JSON body (POST),
 * defaulting the issuer to the requesting origin so it is correct whether the server is
 * reached via localhost or a tunnelled address such as an ngrok URL.
 * @param req The incoming Express request.
 * @returns The options to pass to signJwt.
 */
function getIssueTokenOptions(req: Request): IssueTokenOptions {
	const source = (req.method === "GET" ? req.query : req.body) as { [key: string]: unknown } | undefined;
	const { sub, aud, issuer, expiresIn, ...claims } = source ?? {};
	const defaultIssuer = `${req.protocol}://${req.get("host") ?? ""}`;

	return {
		sub: asString(sub),
		aud: asString(aud),
		issuer: asString(issuer) ?? defaultIssuer,
		expiresIn: asString(expiresIn),
		claims
	};
}

app.get("/.well-known/jwks.json", async (req: Request, res: Response) => {
	const jwks = await getJwks();
	res.status(200).json(jwks);
});

/**
 * Issue a new JWT based on the request's query string or JSON body.
 * @param req The incoming Express request.
 * @param res The Express response.
 */
async function issueToken(req: Request, res: Response): Promise<void> {
	try {
		const options = getIssueTokenOptions(req);
		const issuedToken = await signJwt(options);
		res.status(200).json(issuedToken);
	} catch (error) {
		console.error("Failed to issue token", error);
		res.status(500).json({ error: "Failed to issue token" });
	}
}

app.get("/api/token", issueToken);
app.post("/api/token", issueToken);

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

app.listen(port, () => {
	const baseUrl = `http://localhost:${port}`;
	console.log(`JWKS example server is running on ${baseUrl}`);
	console.log(`JWKS endpoint: ${baseUrl}/.well-known/jwks.json`);
	console.log(`Issue a token: curl "${baseUrl}/api/token?sub=demo-user&aud=my-app"`);
	console.log(
		`Verify a token: curl -X POST ${baseUrl}/api/verify -H "Content-Type: application/json" -d "{\\"token\\":\\"...\\"}"`
	);
	console.log(`To reach this server from another machine, run: ngrok http ${port}`);
});
