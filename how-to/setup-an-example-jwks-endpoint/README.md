![Here Node Adapter Example -- How To Setup An Example JWKS Endpoint](../../assets/hero-starter-nodejs.png)

> **_:information_source: Here Node Adapter:_** [Here Node Adapter](https://cdn.openfin.co/docs/javascript/32.114.76.14/) is a commercial product and this repo is for evaluation purposes. Use of the Here Node Adapter and Here Core components is only granted pursuant to a license from Here. Please [**contact us**](https://www.here.io/here-core/) if you would like to request a developer evaluation key or to discuss a production license.

## Learning more about Node

This example is a simple Node/Express server that doesn't use the node adapter but is useful when you need something to generate real, verifiable JWTs while you're building or testing anything that expects a `jwtRequestCallback`, a bearer token, or a JWKS (JSON Web Key Set) endpoint. It:

- Generates an RSA key pair in memory when the process starts.
- Exposes a standards-compliant JWKS endpoint at `GET /.well-known/jwks.json`, publishing the public key.
- Exposes `GET`/`POST /api/token` to issue (sign) an RS256 JWT using the private key — **this is the primary endpoint of the example**. Other how-to examples in this repo (or any external app) can call it directly whenever they need a throwaway signed JWT to test against.
- Exposes `POST /api/verify` so you can verify a token against this server's own JWKS, closing the loop from issue -> publish -> verify without needing an external tool.
- Ships a reference [`client/jwtRequestCallback.ts`](./client/jwtRequestCallback.ts) helper for wiring a token from this server into a synchronous `jwtRequestCallback`, such as `@openfin/cloud-interop`'s `jwtAuthenticationParameters.jwtRequestCallback`.
- Works unmodified behind an [ngrok](https://ngrok.com/) tunnel, so a second machine can call it.

This example is written as a native ES module (`"type": "module"`) rather than following the CommonJS pattern used by some of the other how-tos in this repo.

### Node App

The node app project can be found in [server/src/index.ts](./server/src/index.ts) and [server/src/keys.ts](./server/src/keys.ts).

The node app is built when `npm run build` is run.

The node app is started when `npm run server` is run.

> **_:warning: Ephemeral keys:_** The RSA key pair is generated fresh, in memory, every time the server starts. This keeps the example simple, but it also means any tokens issued before a restart can no longer be verified against the JWKS afterwards (the `kid` will no longer match).

## Endpoints

| Endpoint                 | Method       | Description                                                                                                    |
| ------------------------ | ------------ | -------------------------------------------------------------------------------------------------------------- |
| `/.well-known/jwks.json` | `GET`        | Returns this server's public key(s) as a JWK Set (`{ "keys": [...] }`).                                        |
| `/api/token`             | `GET`/`POST` | Issues a new RS256 JWT. Accepts `sub`, `aud`, `issuer`, `expiresIn`, and any additional custom claims.         |
| `/api/verify`            | `POST`       | Verifies a token (`{ "token": "..." }`) against this server's own JWKS and returns the decoded header/payload. |

### Issuing a token

```bash
curl "http://localhost:6061/api/token?sub=demo-user&aud=my-app&preferred_username=demo-user"
```

```json
{
  "token": "eyJhbGciOiJSUzI1NiIsImtpZCI6Ii4uLiJ9...",
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

5. Open your desktop browser and visit <http://localhost:6061> to use the demo page, which lets you issue a token, view the JWKS, and verify a token.

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

It also reads the same environment variable names as the snippet above (`AUTHENTICATION_PREFERRED_SUB`, `AUTHENTICATION_AUDIENCE`, `AUTHENTICATION_ISSUER`, `AUTHENTICATION_PREFERRED_USERNAME`), plus `JWKS_EXAMPLE_TOKEN_ENDPOINT` for the `/api/token` URL, so it can be used as a near drop-in replacement without changing your existing environment configuration.

> **_:information_source: This is a genuinely synchronous callback, not an async one:_** `jwtAuthenticationParameters.jwtRequestCallback` is called synchronously and does not support being passed an async function or a function that returns a `Promise`. All of the async work (the network call to `/api/token`, and periodic background refreshes) happens _before_ and _around_ the callback, not inside it. `await createJwtRequestCallback(...)` does the initial fetch and resolves to a plain `() => string` function that simply returns whatever token is already cached in memory — the token is always generated and ready ahead of time, so the callback itself never needs to wait on anything.

<!-- -->

> **_:warning: Set `iss`/`aud` to what the relying party expects, don't rely on auto-detect:_** This server's own `/api/verify` endpoint (and the demo page) only check the token's signature, so leaving `issuer` blank and letting it default to this server's own URL is fine for self-testing. A real relying party such as `@openfin/cloud-interop` instead validates the token's `iss` and `aud` claims against values it already knows about (tied to your registered `authenticationId`), which have nothing to do with this JWKS server's hostname. Before using a token with a real relying party, always explicitly set `issuer`/`aud` (via the demo page fields, `curl` query/body params, or the `AUTHENTICATION_ISSUER`/`AUTHENTICATION_AUDIENCE` env vars / `issuer`/`aud` options passed to `createJwtRequestCallback`) to whatever that party expects — the JWKS URL only needs to serve the correct public key, it doesn't need to match `iss`.

<!-- -->

> **_:information_source: Registering this server's JWKS URL with a real relying party:_** `@openfin/cloud-interop`'s `jwtAuthenticationParameters` only accepts `authenticationId` and `jwtRequestCallback` — there's no client-side field for the JWKS URL or issuer. Matching a JWKS URL to an `authenticationId` is done out-of-band: contact Here support with the JWKS URL this server is (or will be) reachable at, e.g. `https://<subdomain>.ngrok-free.app/.well-known/jwks.json`, so they can register it against your `authenticationId`, and agree with them on the exact `iss`/`aud` values to use. Since ngrok's free tier assigns a new random subdomain on every restart, any such registration will go stale as soon as the tunnel restarts — use an ngrok reserved/static domain (or host this example somewhere with a stable URL) if you need the registration to keep working across restarts.

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

> **_:warning: If your organization doesn't allow ngrok:_** many organizations block or restrict tunnelling tools like ngrok for security reasons. If that's the case for you, you'll need to deploy this example to a dev/staging server (or any host reachable over HTTPS by whoever needs to call it) instead. Nothing about this example is ngrok-specific — it's a plain Express app that reads its port from the `PORT` environment variable, already trusts standard reverse-proxy headers (`app.set('trust proxy', true)`), and leaves CORS fully open — so it can be deployed the same way you'd deploy any other small Node service (a VM, container, internal dev server, or a PaaS such as Render/Railway/Fly.io/Azure App Service/AWS). Once deployed, just substitute that server's URL wherever this README references the ngrok URL or `http://localhost:6061`.
