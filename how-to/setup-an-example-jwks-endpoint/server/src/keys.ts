import {
	calculateJwkThumbprint,
	decodeProtectedHeader,
	exportJWK,
	generateKeyPair,
	jwtVerify,
	SignJWT
} from "jose";
import type { JWK, JWTHeaderParameters, JWTPayload, JWTVerifyResult } from "jose";
import { randomBytes } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const ALGORITHM = "RS256";
const HMAC_ALGORITHM = "HS256";
const DEFAULT_EXPIRES_IN = "1h";

// The generated secret is persisted here so it survives server restarts. Without this you would
// have to reconfigure the relying party (e.g. cloud interop) with a new secret every restart.
const HMAC_SECRET_FILENAME = ".hmac-secret";
const HMAC_SECRET_BYTES = 32;

/**
 *
 */
interface KeySet {
	/**
	 *
	 */
	privateKey: CryptoKey;
	/**
	 *
	 */
	publicKey: CryptoKey;
	/**
	 *
	 */
	kid: string;
	/**
	 *
	 */
	publicJwk: JWK;
}

let keySetPromise: Promise<KeySet> | undefined;

/**
 * Generate a fresh RSA key pair and derive the public JWK (including its kid) from it.
 * @returns The generated key set.
 */
async function createKeySet(): Promise<KeySet> {
	const { privateKey, publicKey } = await generateKeyPair(ALGORITHM, {
		modulusLength: 2048,
		extractable: true
	});
	const exportedPublicJwk = await exportJWK(publicKey);
	const kid = await calculateJwkThumbprint(exportedPublicJwk);
	const publicJwk: JWK = {
		...exportedPublicJwk,
		kid,
		use: "sig",
		alg: ALGORITHM
	};

	return { privateKey, publicKey, kid, publicJwk };
}

/**
 * Lazily generate (once) and cache the server's signing key pair for the lifetime of the process.
 * @returns The cached key set.
 */
async function getKeySet(): Promise<KeySet> {
	if (!keySetPromise) {
		keySetPromise = createKeySet();
	}
	return keySetPromise;
}

/**
 * Build the JWK Set that should be served from the /.well-known/jwks.json endpoint.
 * @returns A JWK Set containing this server's public signing key.
 */
export async function getJwks(): Promise<{ keys: JWK[] }> {
	const { publicJwk } = await getKeySet();
	return { keys: [publicJwk] };
}

/**
 * Where the currently loaded HMAC secret came from. A secret supplied via the environment is
 * treated as immutable, so the UI can disable refreshing it.
 */
export type HmacSecretSource = "env" | "file" | "generated";

let hmacSecret = "";
let hmacSecretSource: HmacSecretSource = "generated";

/**
 * Resolve the path the persisted HMAC secret is read from and written to. This sits alongside
 * package.json rather than in the build output so it isn't lost on a rebuild.
 * @returns The absolute path of the secret file.
 */
function getHmacSecretPath(): string {
	return path.join(process.cwd(), HMAC_SECRET_FILENAME);
}

/**
 * Generate a new random shared secret, as a base64url string so it can be copied and pasted
 * into another system's configuration without any escaping concerns.
 * @returns The newly generated secret.
 */
function generateHmacSecret(): string {
	return randomBytes(HMAC_SECRET_BYTES).toString("base64url");
}

/**
 * Write the secret to disk so it survives a restart, warning (rather than failing) if the file
 * can't be written, since an in-memory-only secret is still usable for the current run.
 * @param secret The secret to persist.
 */
async function persistHmacSecret(secret: string): Promise<void> {
	try {
		await writeFile(getHmacSecretPath(), `${secret}\n`, "utf8");
	} catch (error) {
		console.warn(
			`Could not persist the shared secret to ${getHmacSecretPath()}. It will be regenerated on the next restart.`,
			error
		);
	}
}

/**
 * Load the shared secret used for HS256 signing, preferring an explicitly configured secret,
 * then a previously persisted one, and only generating (and saving) a new one as a last resort.
 * Must be called once before any of the HMAC helpers below are used.
 */
export async function initHmacSecret(): Promise<void> {
	const fromEnvironment = process.env.HMAC_SECRET;
	if (fromEnvironment !== undefined && fromEnvironment.length > 0) {
		hmacSecret = fromEnvironment;
		hmacSecretSource = "env";
		return;
	}

	try {
		const fileContents = await readFile(getHmacSecretPath(), "utf8");
		const persisted = fileContents.trim();
		if (persisted.length > 0) {
			hmacSecret = persisted;
			hmacSecretSource = "file";
			return;
		}
	} catch {
		// No secret has been persisted yet, so fall through and create one.
	}

	hmacSecret = generateHmacSecret();
	hmacSecretSource = "generated";
	await persistHmacSecret(hmacSecret);
}

/**
 * Read the current shared secret, in the exact form it should be pasted into the verifying
 * system's configuration.
 * @returns The current shared secret.
 */
export function getHmacSecret(): string {
	return hmacSecret;
}

/**
 * Report where the current secret was loaded from, so callers can explain it to the user.
 * @returns The source of the current secret.
 */
export function getHmacSecretSource(): HmacSecretSource {
	return hmacSecretSource;
}

/**
 * Whether the secret was supplied via the HMAC_SECRET environment variable, in which case it
 * cannot be rotated at runtime.
 * @returns True if the secret came from the environment.
 */
export function isHmacSecretFromEnv(): boolean {
	return hmacSecretSource === "env";
}

/**
 * Rotate to a freshly generated shared secret and persist it. Any token already issued with the
 * previous secret stops verifying, and the new secret has to be copied to the verifying system.
 * @returns The new secret.
 * @throws If the secret is fixed by the HMAC_SECRET environment variable.
 */
export async function refreshHmacSecret(): Promise<string> {
	if (isHmacSecretFromEnv()) {
		throw new Error(
			"The shared secret is fixed by the HMAC_SECRET environment variable and cannot be refreshed at runtime. Unset it (or change its value) and restart the server instead."
		);
	}

	hmacSecret = generateHmacSecret();
	hmacSecretSource = "generated";
	await persistHmacSecret(hmacSecret);

	return hmacSecret;
}

/**
 * Encode the shared secret as the byte array jose expects for HMAC operations.
 * @returns The secret's bytes.
 */
function getHmacKey(): Uint8Array {
	return new TextEncoder().encode(hmacSecret);
}

/**
 * The signing algorithms this server can issue tokens with. RS256 is verified via the JWKS
 * endpoint, HS256 via the shared secret.
 */
export type SigningAlgorithm = "RS256" | "HS256";

/**
 * The claims and expiry to use when issuing a token.
 */
export interface IssueTokenOptions {
	/**
	 * The subject (sub) claim, typically the user the token represents.
	 */
	sub?: string;
	/**
	 * The audience (aud) claim, which the verifying system usually checks against a fixed value.
	 */
	aud?: string;
	/**
	 * The issuer (iss) claim, which the verifying system usually checks against a fixed value.
	 */
	issuer?: string;
	/**
	 * How long the token should remain valid, e.g. "1h" or a number of seconds.
	 */
	expiresIn?: string | number;
	/**
	 * Any additional custom claims to include in the payload.
	 */
	claims?: { [key: string]: unknown };
}

/**
 * A freshly issued token, along with the details needed to verify it elsewhere.
 */
export interface IssuedToken {
	/**
	 * The raw compact JWT (header.payload.signature). This is the value to use as a bearer token.
	 */
	token: string;
	/**
	 * The algorithm the token was signed with.
	 */
	algorithm: SigningAlgorithm;
	/**
	 * The key id published on the JWKS endpoint, for RS256 tokens only.
	 */
	kid?: string;
	/**
	 * The shared secret needed to verify the token, for HS256 tokens only.
	 */
	secret?: string;
	/**
	 * The issuer (iss) claim the token was signed with.
	 */
	issuer?: string;
	/**
	 * The expiry that was applied to the token.
	 */
	expiresIn: string | number;
}

/**
 * Apply the standard registered claims to a token being built, so RS256 and HS256 tokens only
 * differ by how they are signed.
 * @param options The claims and expiry to apply.
 * @param header The protected header, which carries the algorithm (and kid, for RS256).
 * @returns The prepared, unsigned token.
 */
function buildJwt(options: IssueTokenOptions, header: JWTHeaderParameters): SignJWT {
	const jwt = new SignJWT({ ...options.claims } as JWTPayload);
	jwt.setProtectedHeader(header);
	jwt.setIssuedAt();

	if (options.sub !== undefined) {
		jwt.setSubject(options.sub);
	}
	if (options.aud !== undefined) {
		jwt.setAudience(options.aud);
	}
	if (options.issuer !== undefined) {
		jwt.setIssuer(options.issuer);
	}
	jwt.setExpirationTime(options.expiresIn ?? DEFAULT_EXPIRES_IN);

	return jwt;
}

/**
 * Sign a new JWT using this server's private key, embedding the kid used to publish the
 * matching public key on the JWKS endpoint.
 * @param options The claims and expiry to use when issuing the token.
 * @returns The signed token along with the kid and expiry that were used.
 */
export async function signJwt(options: IssueTokenOptions): Promise<IssuedToken> {
	const { privateKey, kid } = await getKeySet();
	const jwt = buildJwt(options, { alg: ALGORITHM, kid });
	const token = await jwt.sign(privateKey);

	return {
		token,
		algorithm: ALGORITHM,
		kid,
		issuer: options.issuer,
		expiresIn: options.expiresIn ?? DEFAULT_EXPIRES_IN
	};
}

/**
 * Sign a new JWT using the shared secret rather than this server's private key. Tokens signed
 * this way are verified with the secret itself, so the verifying system never has to reach the
 * JWKS endpoint. The secret is returned alongside the token so it can be copied across.
 * @param options The claims and expiry to use when issuing the token.
 * @returns The signed token along with the secret and expiry that were used.
 */
export async function signJwtHmac(options: IssueTokenOptions): Promise<IssuedToken> {
	const jwt = buildJwt(options, { alg: HMAC_ALGORITHM });
	const token = await jwt.sign(getHmacKey());

	return {
		token,
		algorithm: HMAC_ALGORITHM,
		secret: hmacSecret,
		issuer: options.issuer,
		expiresIn: options.expiresIn ?? DEFAULT_EXPIRES_IN
	};
}

/**
 * Verify a JWT issued by this server, as a convenience for the demo page so users can see the
 * full issue -> publish -> verify loop without an external tool. The token's own algorithm
 * header decides whether it is checked against the public key or the shared secret, so tokens
 * from either signing mode can be pasted in without having to say which is which.
 * @param token The compact JWT to verify.
 * @returns The verification result, containing the decoded header and payload.
 * @throws If the token's algorithm is not one this server issues.
 */
export async function verifyJwt(token: string): Promise<JWTVerifyResult> {
	const { alg } = decodeProtectedHeader(token);

	if (alg === HMAC_ALGORITHM) {
		return jwtVerify(token, getHmacKey(), { algorithms: [HMAC_ALGORITHM] });
	}
	if (alg === ALGORITHM) {
		const { publicKey } = await getKeySet();
		return jwtVerify(token, publicKey, { algorithms: [ALGORITHM] });
	}

	throw new Error(
		`Unsupported algorithm "${alg ?? "none"}". This server only issues RS256 and HS256 tokens.`
	);
}
