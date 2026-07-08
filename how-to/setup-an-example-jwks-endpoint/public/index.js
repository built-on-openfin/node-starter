// The most recently issued raw JWT string, so "Copy Token" can copy just that rather than the
// full response object shown in the Issued Token panel.
let lastIssuedToken;

/**
 * Add a log entry to the log panel.
 * @param logElement The element to append log entries to.
 * @param text The text for the log entry.
 * @param data Optional associated data for the log entry.
 */
function log(logElement, text, data) {
	let entry = `
${new Date(Date.now()).toLocaleTimeString()}: ${text}`;

	if (data !== undefined) {
		entry += `
${JSON.stringify(data, null, 3)}`;
	}

	console.log(text, data);

	logElement.textContent += entry;
}

/**
 * Parse the custom claims textarea content as JSON, returning an empty object on blank input.
 * @param rawClaims The raw text from the custom claims textarea.
 * @returns The parsed claims object.
 */
function parseClaims(rawClaims) {
	const trimmed = rawClaims.trim();
	if (trimmed.length === 0) {
		return {};
	}
	return JSON.parse(trimmed);
}

/**
 * Issue a new token from the server using the values currently in the form.
 * @param elements The relevant form/output elements.
 */
async function issueToken(elements) {
	try {
		const claims = parseClaims(elements.claims.value);
		const body = {
			sub: elements.sub.value.trim() || undefined,
			aud: elements.aud.value.trim() || undefined,
			issuer: elements.issuer.value.trim() || undefined,
			expiresIn: elements.expiresIn.value.trim() || undefined,
			...claims
		};

		log(elements.log, 'Requesting a new token', body);

		const response = await fetch('/api/token', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify(body)
		});

		if (!response.ok) {
			throw new Error(`Server responded with ${response.status}`);
		}

		const issuedToken = await response.json();
		lastIssuedToken = issuedToken.token;
		elements.tokenOutput.textContent = JSON.stringify(issuedToken, null, 2);
		elements.verifyToken.value = issuedToken.token;
		log(elements.log, 'Token issued', issuedToken);
	} catch (error) {
		log(elements.log, `Failed to issue token: ${error.message}`);
	}
}

/**
 * Copy just the raw JWT string (not the surrounding response object) to the clipboard. This is
 * what should be used as a bearer token or hardcoded wherever a compact JWS is expected --
 * pasting the full JSON object from "Copy JSON" instead will fail with errors such as
 * "JWSInvalid: Invalid Compact JWS".
 * @param elements The relevant form/output elements.
 */
async function copyTokenOnly(elements) {
	if (lastIssuedToken === undefined) {
		log(elements.log, 'Issue a token first before copying it');
		return;
	}
	try {
		await navigator.clipboard.writeText(lastIssuedToken);
		log(elements.log, 'Copied raw token to the clipboard');
	} catch (error) {
		log(elements.log, `Failed to copy to clipboard: ${error.message}`);
	}
}

/**
 * Copy the currently displayed issued token JSON to the clipboard, so it can be pasted
 * elsewhere (e.g. hard-coded into test code).
 * @param elements The relevant form/output elements.
 */
async function copyTokenJson(elements) {
	try {
		await navigator.clipboard.writeText(elements.tokenOutput.textContent);
		log(elements.log, 'Copied issued token JSON to the clipboard');
	} catch (error) {
		log(elements.log, `Failed to copy to clipboard: ${error.message}`);
	}
}

/**
 * Fetch and display this server's JWKS.
 * @param elements The relevant form/output elements.
 */
async function viewJwks(elements) {
	try {
		const response = await fetch('/.well-known/jwks.json');
		if (!response.ok) {
			throw new Error(`Server responded with ${response.status}`);
		}
		const jwks = await response.json();
		elements.jwksOutput.textContent = JSON.stringify(jwks, null, 3);
		log(elements.log, 'Fetched JWKS', jwks);
	} catch (error) {
		log(elements.log, `Failed to fetch JWKS: ${error.message}`);
	}
}

/**
 * Copy this server's fully-qualified JWKS URL to the clipboard, using whatever origin the page
 * was loaded through (localhost, an ngrok URL, etc.), so it can be pasted into a relying party's
 * configuration.
 * @param elements The relevant form/output elements.
 */
async function copyJwksUrl(elements) {
	const jwksUrl = `${window.location.origin}/.well-known/jwks.json`;
	try {
		await navigator.clipboard.writeText(jwksUrl);
		log(elements.log, `Copied JWKS URL to the clipboard: ${jwksUrl}`);
	} catch (error) {
		log(elements.log, `Failed to copy to clipboard: ${error.message}`);
	}
}

/**
 * Verify the token currently entered in the "Token To Verify" textarea.
 * @param elements The relevant form/output elements.
 */
async function verifyToken(elements) {
	try {
		const token = elements.verifyToken.value.trim();
		if (token.length === 0) {
			throw new Error('Enter or issue a token to verify first');
		}

		const response = await fetch('/api/verify', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ token })
		});
		const result = await response.json();
		elements.verifyOutput.textContent = JSON.stringify(result, null, 3);
		log(elements.log, response.ok ? 'Token verified' : 'Token verification failed', result);
	} catch (error) {
		log(elements.log, `Failed to verify token: ${error.message}`);
	}
}

document.addEventListener('DOMContentLoaded', () => {
	const elements = {
		sub: document.querySelector('#sub'),
		aud: document.querySelector('#aud'),
		issuer: document.querySelector('#issuer'),
		expiresIn: document.querySelector('#expiresIn'),
		claims: document.querySelector('#claims'),
		tokenOutput: document.querySelector('#tokenOutput'),
		jwksOutput: document.querySelector('#jwksOutput'),
		verifyToken: document.querySelector('#verifyToken'),
		verifyOutput: document.querySelector('#verifyOutput'),
		log: document.querySelector('#log')
	};

	const btnIssueToken = document.querySelector('#btnIssueToken');
	const btnCopyTokenOnly = document.querySelector('#btnCopyTokenOnly');
	const btnCopyToken = document.querySelector('#btnCopyToken');
	const btnViewJwks = document.querySelector('#btnViewJwks');
	const btnCopyJwksUrl = document.querySelector('#btnCopyJwksUrl');
	const btnVerifyToken = document.querySelector('#btnVerifyToken');
	const btnClear = document.querySelector('#btnClear');

	btnIssueToken.addEventListener('click', () => {
		issueToken(elements).catch((error) => {
			console.error('Unhandled error issuing token', error);
		});
	});

	btnCopyTokenOnly.addEventListener('click', () => {
		copyTokenOnly(elements).catch((error) => {
			console.error('Unhandled error copying token', error);
		});
	});

	btnCopyToken.addEventListener('click', () => {
		copyTokenJson(elements).catch((error) => {
			console.error('Unhandled error copying token JSON', error);
		});
	});

	btnViewJwks.addEventListener('click', () => {
		viewJwks(elements).catch((error) => {
			console.error('Unhandled error fetching JWKS', error);
		});
	});

	btnCopyJwksUrl.addEventListener('click', () => {
		copyJwksUrl(elements).catch((error) => {
			console.error('Unhandled error copying JWKS URL', error);
		});
	});

	btnVerifyToken.addEventListener('click', () => {
		verifyToken(elements).catch((error) => {
			console.error('Unhandled error verifying token', error);
		});
	});

	btnClear.addEventListener('click', () => {
		elements.log.textContent = '';
	});
});
