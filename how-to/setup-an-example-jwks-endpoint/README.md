![Here Node Adapter Example -- How To Setup An Example JWKS Endpoint](../../assets/hero-starter-nodejs.png)

> **_:information_source: Here Node Adapter:_** [Here Node Adapter](https://cdn.openfin.co/docs/javascript/32.114.76.14/) is a commercial product and this repo is for evaluation purposes. Use of the Here Node Adapter and Here Core components is only granted pursuant to a license from Here. Please [**contact us**](https://www.here.io/here-core/) if you would like to request a developer evaluation key or to discuss a production license.

## Learning more about Node

This example is a simple Node/Express server that doesn't use the node adapter but is useful when you need something to generate real, verifiable JWTs while you're building or testing anything that expects a `jwtRequestCallback`, a bearer token, or a JWKS (JSON Web Key Set) endpoint. It:

- Generates an RSA key pair in memory when the process starts.
- Exposes a standards-compliant JWKS endpoint at `GET /.well-known/jwks.json`, publishing the public key.
- Exposes an OIDC discovery document at `GET /.well-known/openid-configuration`, like Entra ID and Keycloak do, so verifiers that discover the `jwks_uri` rather than having it hardcoded can point at this server unchanged.
- Exposes `GET`/`POST /api/token` to issue (sign) an RS256 JWT using the private key — **this is the primary endpoint of the example**. Other how-to examples in this repo (or any external app) can call it directly whenever they need a throwaway signed JWT to test against.
- Can also issue HS256 tokens signed with a **shared secret** instead, for test scenarios where the verifying system cannot reach the JWKS endpoint at all. See [Using a shared secret instead of JWKS](#using-a-shared-secret-instead-of-jwks-test-only).
- Exposes `POST /api/verify` so you can verify a token against this server's own JWKS (or shared secret), closing the loop from issue -> publish -> verify without needing an external tool.
- Ships a reference [`client/jwtRequestCallback.ts`](./client/jwtRequestCallback.ts) helper for wiring a token from this server into a synchronous `jwtRequestCallback`, such as `@openfin/cloud-interop`'s `jwtAuthenticationParameters.jwtRequestCallback`.
- Works unmodified behind an [ngrok](https://ngrok.com/) tunnel, so a second machine can call it.

This example is written as a native ES module (`"type": "module"`) rather than following the CommonJS pattern used by some of the other how-tos in this repo.

### Node App

The node app project can be found in [server/src/index.ts](./server/src/index.ts) and [server/src/keys.ts](./server/src/keys.ts).

The node app is built when `npm run build` is run.

The node app is started when `npm run server` is run.

> **_:warning: Ephemeral RSA keys:_** The RSA key pair is generated fresh, in memory, every time the server starts. This keeps the example simple, but it also means any RS256 token issued before a restart can no longer be verified against the JWKS afterwards (the `kid` will no longer match). The HS256 shared secret behaves differently — it _is_ persisted across restarts, as described in [Using a shared secret instead of JWKS](#using-a-shared-secret-instead-of-jwks-test-only).

## Endpoints

| Endpoint                            | Method       | Description                                                                                                                      |
| ----------------------------------- | ------------ | -------------------------------------------------------------------------------------------------------------------------------- |
| `/.well-known/jwks.json`            | `GET`        | Returns this server's public key(s) as a JWK Set (`{ "keys": [...] }`).                                                          |
| `/.well-known/openid-configuration` | `GET`        | OIDC discovery document, pointing at the `issuer`, `jwks_uri` and `token_endpoint` for the URL it was requested through.         |
| `/api/token`                        | `GET`/`POST` | Issues a new JWT. Accepts `algorithm` (`RS256` default, or `HS256`), `sub`, `aud`, `issuer`, `expiresIn`, and any custom claims. |
| `/api/verify`                       | `POST`       | Verifies a token (`{ "token": "..." }`) against this server's JWKS or shared secret, and returns the decoded header/payload.     |
| `/api/secret`                       | `GET`        | Returns the current shared secret and where it came from (`{ "secret": "...", "source": "env" \| "file" \| "generated" }`).      |
| `/api/secret/refresh`               | `POST`       | Rotates to a newly generated shared secret. Returns `400` if the secret is fixed by the `HMAC_SECRET` environment variable.      |

### Issuing a token

```bash
curl "http://localhost:6061/api/token?sub=demo-user&aud=my-app&preferred_username=demo-user"
```

```json
{
  "token": "eyJhbGciOiJSUzI1NiIsImtpZCI6Ii4uLiJ9...",
  "algorithm": "RS256",
  "kid": "NzbLsXh8uDCcd-6MNwXF4W_7noWXFZAfHkxZsRGC9Xs",
  "issuer": "http://localhost:6061",
  "expiresIn": "1h"
}
```

You can also `POST` a JSON body instead of using query params, which is more convenient for extra custom claims:

```bash
curl -X POST http://localhost:6061/api/token \
  -H "Content-Type: application/json" \
  -d '{ "sub": "demo-user", "aud": "my-app", "preferred_username": "demo-user" }'
```

`issuer` is optional — if you don't supply one, it defaults to the origin the request was made through (`http://localhost:6061`, or your ngrok URL if you're tunnelling, see below), so it's always correct without any extra configuration.

> **_:warning: `JWSInvalid: Invalid Compact JWS` when verifying elsewhere:_** this means whatever value was used as the token wasn't a raw compact JWS (`header.payload.signature`) — usually because the **whole response object** (`{ "token": "...", "kid": "...", ... }`) was used instead of just its `token` field. On the demo page, use the **Copy Token** button (not **Copy JSON**) to copy only the raw JWT string, or when scripting, make sure you read `.token` off the `/api/token` response before using it.

## Using a shared secret instead of JWKS (test only)

Verifying an RS256 token requires the verifying system to fetch this server's public key from the JWKS endpoint. That's the right approach, and it's how real identity providers such as Entra ID and Keycloak work — but it does mean the JWKS URL has to be reachable from wherever verification happens. If it isn't (a firewall in the way, no ngrok, nowhere to deploy this example), you can instead sign tokens with a **shared secret** using HS256. The verifying system then checks the signature with that same secret and never makes an outbound request.

Pass `algorithm=HS256` to get a token signed this way. The secret needed to verify it comes back alongside the token:

```bash
curl "http://localhost:6061/api/token?sub=demo-user&aud=my-app&algorithm=HS256"
```

```json
{
  "token": "eyJhbGciOiJIUzI1NiJ9...",
  "algorithm": "HS256",
  "secret": "q6ylH4iMYoMyQ6EbyzV4d2hncvei0jmwuHXsPcFqt3Y",
  "issuer": "http://localhost:6061",
  "expiresIn": "1h"
}
```

On the demo page, set **Signing Algorithm** to `HS256` before clicking **Issue Token**, then use the **Copy Secret** button in the **Shared Secret (HS256)** panel to copy the secret into the verifying system's configuration (for example, in place of the JWKS URI in your cloud interop settings).

### Where the secret comes from

The secret is resolved once at startup, in this order:

1. The `HMAC_SECRET` environment variable, if set. This always wins and is never written to disk.
2. A `.hmac-secret` file next to `package.json`, if one exists from a previous run.
3. Otherwise a new 256-bit random secret is generated and saved to `.hmac-secret`.

Because it's persisted, **the secret survives a server restart** — you don't have to reconfigure the verifying system every time you restart this example. `.hmac-secret` is in `.gitignore` and should never be committed.

To rotate it deliberately, use the **Refresh Secret** button on the demo page (or `POST /api/secret/refresh`). Every token issued with the previous secret stops verifying immediately, so the new secret has to be copied across.

If the secret was set via `HMAC_SECRET`, the demo page says so and disables the **Refresh Secret** button, since an environment variable can't be changed at runtime — change the variable and restart the server instead.

> **_:warning: Shared secrets are for test scenarios only:_** HS256 is symmetric, so anyone holding the secret can mint tokens that look exactly like yours, and the secret has to be distributed to every system that verifies it. It's a pragmatic way to get unblocked while testing, but production setups should use RS256 with a properly reachable JWKS endpoint. Note also that the secret itself has no expiry — only the tokens it signs do (via `expiresIn`, `1h` by default) — so rotate it yourself when you're done testing.

## Build the Node application

1. Ensure that you are in the sub-folder that contains the code.

2. Run

   ```bash
   npm run setup
   ```

   to install the dependencies

3. Run

   ```bash
   npm run build
   ```

   to build the node app.

   - **Note**. Please remember to repeat steps 1 through 3 each time you modify the code.

4. Run

   ```bash
   npm run start
   ```

   to start the server.

5. Open your desktop browser and visit <http://localhost:6061> to use the demo page, which lets you issue a token (RS256 or HS256), view the JWKS, copy the JWKS/discovery URLs and shared secret, and verify a token.

## Using the JWT as a jwtRequestCallback

Some APIs (such as `@openfin/cloud-interop`'s `jwtAuthenticationParameters`) expect a **synchronous** callback that returns a JWT, e.g.:

```ts
jwtRequestCallback: () => {
  // For the sake of demonstration we are going to just generate a new JWT each time.
  const rawJWT = {
    sub: process.env.AUTHENTICATION_PREFERRED_SUB,
    aud: process.env.AUTHENTICATION_AUDIENCE,
    iss: process.env.AUTHENTICATION_ISSUER,
    preferred_username: process.env.AUTHENTICATION_PREFERRED_USERNAME
  };

  const token = jwt.sign(rawJWT, process.env.AUTHENTICATION_SECRET!);

  return token;
};
```

That pattern signs a token locally with a shared secret. This example's [`client/jwtRequestCallback.ts`](./client/jwtRequestCallback.ts) is a drop-in, copy-pasteable replacement that instead fetches a real, verifiable RS256 token from this server (so it can be verified by anyone using the JWKS endpoint, with no shared secret to distribute). Since fetching a token over the network is asynchronous but the callback itself must be synchronous, it fetches a token up front and keeps it refreshed in the background:

```ts
import { createJwtRequestCallback } from './jwtRequestCallback';

const jwtRequestCallback = await createJwtRequestCallback({
  tokenEndpoint: 'http://localhost:6061/api/token',
  sub: 'demo-user',
  aud: 'my-app',
  preferredUsername: 'demo-user'
});

const cloudConfig = {
  url: '<CLOUD_INTEROP_SERVICE_URL>',
  platformId: 'my-platform',
  sourceId: 'my-desktop',
  authenticationType: 'jwt',
  jwtAuthenticationParameters: {
    authenticationId: '...',
    jwtRequestCallback
  }
};
```

It also reads the same environment variable names as the snippet above (`AUTHENTICATION_PREFERRED_SUB`, `AUTHENTICATION_AUDIENCE`, `AUTHENTICATION_ISSUER`, `AUTHENTICATION_PREFERRED_USERNAME`), plus `JWKS_EXAMPLE_TOKEN_ENDPOINT` for the `/api/token` URL and `AUTHENTICATION_ALGORITHM` to pick the signing algorithm, so it can be used as a near drop-in replacement without changing your existing environment configuration.

If the cloud interop service can't reach this server's JWKS endpoint, pass `algorithm: 'HS256'` so it can verify with the shared secret instead (see [Using a shared secret instead of JWKS](#using-a-shared-secret-instead-of-jwks-test-only)):

```ts
const jwtRequestCallback = await createJwtRequestCallback({
  tokenEndpoint: 'http://localhost:6061/api/token',
  algorithm: 'HS256',
  sub: 'demo-user',
  aud: 'my-app',
  preferredUsername: 'demo-user'
});
```

> **_:information_source: This is a genuinely synchronous callback, not an async one:_** `jwtAuthenticationParameters.jwtRequestCallback` is called synchronously and does not support being passed an async function or a function that returns a `Promise`. All of the async work (the network call to `/api/token`, and periodic background refreshes) happens _before_ and _around_ the callback, not inside it. `await createJwtRequestCallback(...)` does the initial fetch and resolves to a plain `() => string` function that simply returns whatever token is already cached in memory — the token is always generated and ready ahead of time, so the callback itself never needs to wait on anything.

<!-- -->

> **_:warning: The callback must return the raw JWT string, not the Issued Token JSON:_** `jwtAuthenticationParameters.jwtRequestCallback` is handed straight to the cloud interop verifier as a compact JWS (`header.payload.signature`). If you copy the whole **Issued Token** panel (`{ "token": "...", "algorithm": "...", ... }`) and return that from the callback, verification fails with `JWSInvalid: Invalid Compact JWS`. On the demo page, use the **Copy Token** button (not **Copy JSON**), or take only the `token` property of that JSON object. `createJwtRequestCallback` already returns just that string.

<!-- -->

> **_:warning: Set `iss`/`aud` to what the relying party expects, don't rely on auto-detect:_** This server's own `/api/verify` endpoint (and the demo page) only check the token's signature, so leaving `issuer` blank and letting it default to this server's own URL is fine for self-testing. A real relying party such as `@openfin/cloud-interop` instead validates the token's `iss` and `aud` claims against values it already knows about (tied to your registered `authenticationId`), which have nothing to do with this JWKS server's hostname. Before using a token with a real relying party, always explicitly set `issuer`/`aud` (via the demo page fields, `curl` query/body params, or the `AUTHENTICATION_ISSUER`/`AUTHENTICATION_AUDIENCE` env vars / `issuer`/`aud` options passed to `createJwtRequestCallback`) to whatever that party expects — the JWKS URL only needs to serve the correct public key, it doesn't need to match `iss`.

<!-- -->

> **_:information_source: Registering this server's JWKS URL with a real relying party:_** `@openfin/cloud-interop`'s `jwtAuthenticationParameters` only accepts `authenticationId` and `jwtRequestCallback` — there's no client-side field for the JWKS URL or issuer. Matching a JWKS URL to an `authenticationId` is done out-of-band: contact Here support with the JWKS URL this server is (or will be) reachable at, e.g. `https://<subdomain>.ngrok-free.app/.well-known/jwks.json`, so they can register it against your `authenticationId`, and agree with them on the exact `iss`/`aud` values to use. Since ngrok's free tier assigns a new random subdomain on every restart, any such registration will go stale as soon as the tunnel restarts — use an ngrok reserved/static domain (or host this example somewhere with a stable URL) if you need the registration to keep working across restarts. Alternatively, configure the shared secret instead of a JWKS URL, which has nothing URL-shaped to go stale.

## Exposing the server with ngrok

To let another machine call this server, you don't need to change any code or configuration:

1. Start the server: `npm run start`.
2. In another terminal, run `ngrok http 6061` (or whichever port you configured via the `PORT` environment variable).
3. From the other machine, use the `https://<subdomain>.ngrok-free.app` URL that ngrok prints in place of `http://localhost:6061`, e.g. `https://<subdomain>.ngrok-free.app/.well-known/jwks.json` and `.../api/token`.

This works automatically because:

- CORS is left fully open, so requests from any origin succeed without pre-registering anything.
- The server trusts the proxy headers ngrok adds and derives a token's default `issuer` from the request's own origin, so a token requested through the ngrok URL is automatically issued with `iss` set to that same ngrok URL.
- [`client/jwtRequestCallback.ts`](./client/jwtRequestCallback.ts) automatically detects an `*.ngrok-free.app`/`*.ngrok.io`/`*.ngrok.app` `tokenEndpoint` and adds the header described below for you.

> **_:warning: ngrok free-tier warning page:_** ngrok's free tier serves an HTML "visit site" interstitial page to requests that _look like_ they came from a browser (based on things like the `User-Agent` header), which would break JSON parsing for the JWKS/token endpoints if it happens. Most server-to-server HTTP clients (`curl`, `fetch`, `jose`, etc.) don't send a browser-like `User-Agent` and so pass straight through untouched — but since you can't always control what HTTP client the other side uses, it's safest to always send the `ngrok-skip-browser-warning: true` header, e.g.:
>
> ```bash
> curl -H "ngrok-skip-browser-warning: true" https://<subdomain>.ngrok-free.app/.well-known/jwks.json
> ```
>
> or, when verifying tokens with `jose.createRemoteJWKSet` directly (rather than through `client/jwtRequestCallback.ts`):
>
> ```ts
> const JWKS = createRemoteJWKSet(new URL('https://<subdomain>.ngrok-free.app/.well-known/jwks.json'), {
>   headers: { 'ngrok-skip-browser-warning': 'true' }
> });
> ```

<!-- -->

> **_:warning: If your organization doesn't allow ngrok:_** many organizations block or restrict tunnelling tools like ngrok for security reasons. If that's the case for you, you'll need to deploy this example to a dev/staging server (or any host reachable over HTTPS by whoever needs to call it) instead or use the HS256 Shared Secret approach. Nothing about this example is ngrok-specific — it's a plain Express app that reads its port from the `PORT` environment variable, already trusts standard reverse-proxy headers (`app.set('trust proxy', true)`), and leaves CORS fully open — so it can be deployed the same way you'd deploy any other small Node service (a VM, container, internal dev server, or a PaaS such as Render/Railway/Fly.io/Azure App Service/AWS). Once deployed, just substitute that server's URL wherever this README references the ngrok URL or `http://localhost:6061`.
>
> If you can't tunnel _or_ deploy anywhere reachable, use [a shared secret with HS256](#using-a-shared-secret-instead-of-jwks-test-only) instead — the verifying system then needs nothing but the secret and the token, and never has to reach this server at all.
