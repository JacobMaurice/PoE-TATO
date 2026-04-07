// app/api/callback/route.ts
// Handles the redirect from PoE's OAuth server after the user grants consent.
// PoE sends: ?code=...&state=...  (or ?error=... on failure)

import { NextRequest, NextResponse } from "next/server";
import { verifyStateToken } from "@/lib/pkce";

const CLIENT_ID = process.env.POE_CLIENT_ID!;
const CLIENT_SECRET = process.env.POE_CLIENT_SECRET!;
const REDIRECT_URI = process.env.POE_REDIRECT_URI!;
const TOKEN_URL = "https://www.pathofexile.com/oauth/token";

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;

  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const error = searchParams.get("error");
  const errorDescription = searchParams.get("error_description");

  // 1. Handle errors returned by PoE's OAuth server
  if (error) {
    console.error("[callback] OAuth error:", error, errorDescription);
    return NextResponse.redirect(
      new URL(`/?error=${encodeURIComponent(error)}`, req.url)
    );
  }

  if (!code || !state) {
    return NextResponse.redirect(new URL("/?error=missing_params", req.url));
  }

  // 2. Verify the state token and extract the code_verifier.
  //    This prevents CSRF attacks.
  const codeVerifier = verifyStateToken(state);
  if (!codeVerifier) {
    console.error("[callback] Invalid or expired state token");
    return NextResponse.redirect(new URL("/?error=invalid_state", req.url));
  }

  // 3. Exchange the authorization code for tokens.
  //    Authorization codes expire in 30 seconds — do this immediately.
  let tokenData: {
    access_token: string;
    refresh_token?: string;
    expires_in: number;
    token_type: string;
    scope: string;
    username: string;
    sub: string;
  };

  try {
    const tokenRes = await fetch(TOKEN_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        // Required by PoE's developer guidelines
        "User-Agent": `OAuth ${CLIENT_ID}/1.0.0 (contact: your@email.com)`,
      },
      body: new URLSearchParams({
        client_id: CLIENT_ID,
        client_secret: CLIENT_SECRET,
        grant_type: "authorization_code",
        code,
        redirect_uri: REDIRECT_URI,
        code_verifier: codeVerifier,
      }),
    });

    if (!tokenRes.ok) {
      const body = await tokenRes.text();
      console.error("[callback] Token exchange failed:", tokenRes.status, body);
      return NextResponse.redirect(new URL("/?error=token_exchange_failed", req.url));
    }

    tokenData = await tokenRes.json();
  } catch (err) {
    console.error("[callback] Network error during token exchange:", err);
    return NextResponse.redirect(new URL("/?error=network_error", req.url));
  }

  // 4. Store tokens securely.
  //
  //    ACCESS TOKEN: safe to store in an httpOnly secure cookie (short-lived).
  //    REFRESH TOKEN: must stay server-side only. Store in a database.
  //
  //    TODO: Persist tokenData.refresh_token to your database here,
  //    keyed by tokenData.sub (the user's unique PoE account ID).
  //    Example: await db.upsert({ sub: tokenData.sub, refreshToken: tokenData.refresh_token })

  if (tokenData.refresh_token) {
    // placeholder — replace with your actual DB call
    console.log(
      "[callback] TODO: store refresh_token for user:",
      tokenData.sub
    );
  }

  // 5. Set the access token as a secure httpOnly cookie and redirect to the app.
  const response = NextResponse.redirect(new URL("/dashboard", req.url));

  response.cookies.set("poe_access_token", tokenData.access_token, {
    httpOnly: true,   // not accessible to JavaScript — protects against XSS
    secure: true,     // HTTPS only
    sameSite: "lax",  // sent on top-level navigations, not cross-site requests
    maxAge: tokenData.expires_in,
    path: "/",
  });

  return response;
}
