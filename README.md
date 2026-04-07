# poe-tato

A Next.js app that authenticates with the Path of Exile API using OAuth 2.1 (Authorization Code + PKCE).

> This product isn't affiliated with or endorsed by Grinding Gear Games in any way.

---

## Project structure

```
app/
  api/
    login/route.ts      — starts the OAuth flow, redirects user to PoE
    callback/route.ts   — handles PoE's redirect, exchanges code for tokens
  dashboard/page.tsx    — shown after successful login
  page.tsx              — home/login page
lib/
  pkce.ts               — PKCE + signed state token utilities
```

## Setup

### 1. Install dependencies

```bash
npm install
```

### 2. Configure environment variables

```bash
cp .env.example .env.local
```

Edit `.env.local` and fill in:

| Variable | Description |
|---|---|
| `POE_CLIENT_ID` | Your client ID from GGG |
| `POE_CLIENT_SECRET` | Your client secret from GGG |
| `POE_REDIRECT_URI` | `https://poe-tato.vercel.app/api/callback` |
| `STATE_SECRET` | A long random secret (`openssl rand -hex 32`) |

### 3. Register your app with GGG

Email `oauth@grindinggear.com` with:
1. Your PoE account name (with four-digit discriminator)
2. Your application name
3. Client type: **Confidential**
4. Grant types: `authorization_code`, `client_credentials`
5. Scopes you need and why (e.g. `account:profile` — to display the user's username)
6. Redirect URI: `https://poe-tato.vercel.app/api/callback`

### 4. Run locally

```bash
npm run dev
```

Visit `http://localhost:3000`. Note: the OAuth callback won't work locally
since GGG requires HTTPS + a registered domain. Deploy to Vercel to test the full flow.

### 5. Deploy to Vercel

```bash
npx vercel
```

Add the same environment variables in **Vercel → Settings → Environment Variables**.

## OAuth flow

```
User clicks "Log in"
  → GET /api/login
      generates code_verifier, code_challenge, signed state token
      → redirects to pathofexile.com/oauth/authorize

User grants consent on PoE's site
  → PoE redirects to GET /api/callback?code=...&state=...
      verifies state token (extracts code_verifier)
      POSTs to pathofexile.com/oauth/token to exchange code for tokens
      stores access_token in httpOnly secure cookie
      → redirects to /dashboard
```

### Authorization Code + PKCE (account:* scopes)

Used when your app needs to act on behalf of a specific user — the flow
described above.

### Client Credentials (service:* scopes)

Used for server-to-server calls not tied to any user account — e.g. fetching
league data, the Public Stash API, or PvP matches. No user interaction required.
Tokens do not expire but can be revoked manually.

​```ts
// Example: app/api/service-token/route.ts
const res = await fetch("https://www.pathofexile.com/oauth/token", {
  method: "POST",
  headers: { "Content-Type": "application/x-www-form-urlencoded" },
  body: new URLSearchParams({
    client_id: process.env.POE_CLIENT_ID!,
    client_secret: process.env.POE_CLIENT_SECRET!,
    grant_type: "client_credentials",
    scope: "service:psapi",
  }),
});
const { access_token } = await res.json();
​```

> **Warning**: tokens obtained via `client_credentials` are tied to your
> registered account's identity. Keep your `client_secret` strictly server-side.

To use this grant, include `client_credentials` in the grant types listed in
your registration email to GGG, along with the specific `service:*` scopes
you need and why.

## Token storage

- **Access token**: stored in an `httpOnly; Secure; SameSite=Lax` cookie. Valid for 28 days.
- **Refresh token**: currently logged to console. **TODO**: persist to a database (e.g. Vercel Postgres, Supabase, or PlanetScale), keyed by the user's `sub` (PoE account UUID). Valid for 90 days.

## Next steps

- Add a `/api/logout` route that clears the cookie
- Use the access token in server routes to call PoE API endpoints, e.g.:
  ```ts
  const res = await fetch("https://api.pathofexile.com/profile", {
    headers: {
      Authorization: `Bearer ${token}`,
      "User-Agent": `OAuth ${CLIENT_ID}/1.0.0 (contact: your@email.com)`,
    },
  });
  ```