import { calculateJwkThumbprint, exportJWK, generateKeyPair, jwtVerify, SignJWT } from "jose";
import type { JWK, JWTPayload, JWTVerifyResult } from "jose";

const ALGORITHM = "RS256";
const DEFAULT_EXPIRES_IN = "1h";

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
 *
 */
export interface IssueTokenOptions {
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
	expiresIn?: string | number;
	/**
	 *
	 */
	claims?: { [key: string]: unknown };
}

/**
 *
 */
export interface IssuedToken {
	/**
	 *
	 */
	token: string;
	/**
	 *
	 */
	kid: string;
	/**
	 *
	 */
	issuer?: string;
	/**
	 *
	 */
	expiresIn: string | number;
}

/**
 * Sign a new JWT using this server's private key, embedding the kid used to publish the
 * matching public key on the JWKS endpoint.
 * @param options The claims and expiry to use when issuing the token.
 * @returns The signed token along with the kid and expiry that were used.
 */
export async function signJwt(options: IssueTokenOptions): Promise<IssuedToken> {
	const { privateKey, kid } = await getKeySet();
	const expiresIn = options.expiresIn ?? DEFAULT_EXPIRES_IN;

	const jwt = new SignJWT({ ...options.claims } as JWTPayload)
		.setProtectedHeader({ alg: ALGORITHM, kid })
		.setIssuedAt();

	if (options.sub !== undefined) {
		jwt.setSubject(options.sub);
	}
	if (options.aud !== undefined) {
		jwt.setAudience(options.aud);
	}
	if (options.issuer !== undefined) {
		jwt.setIssuer(options.issuer);
	}
	jwt.setExpirationTime(expiresIn);

	const token = await jwt.sign(privateKey);

	return { token, kid, issuer: options.issuer, expiresIn };
}

/**
 * Verify a JWT against this server's own public key, as a convenience for the demo page so
 * users can see the full issue -> publish -> verify loop without an external tool.
 * @param token The compact JWT to verify.
 * @returns The verification result, containing the decoded header and payload.
 */
export async function verifyJwt(token: string): Promise<JWTVerifyResult> {
	const { publicKey } = await getKeySet();
	return jwtVerify(token, publicKey, { algorithms: [ALGORITHM] });
}
