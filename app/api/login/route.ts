// app/api/login/route.ts
// Initiates the OAuth 2.1 Authorization Code + PKCE flow.
// Redirect the user to GET /api/login to begin authentication.

import { NextResponse } from "next/server";
import { generateCodeVerifier, generateCodeChallenge, createStateToken } from "@/lib/pkce";

const CLIENT_ID = process.env.POE_CLIENT_ID!;
const REDIRECT_URI = process.env.POE_REDIRECT_URI!;

// Request only the scopes your application actually needs.
// See: https://www.pathofexile.com/developer/docs/authorization#scopes
const SCOPES = "account:profile account:characters";

export async function GET() {
  // 1. Generate PKCE values
  const codeVerifier = generateCodeVerifier();
  const codeChallenge = generateCodeChallenge(codeVerifier);

  // 2. Create a signed state token that embeds the code_verifier.
  //    This avoids needing a database for short-lived OAuth state.
  const state = createStateToken(codeVerifier);

  // 3. Build the PoE authorization URL
  const params = new URLSearchParams({
    client_id: CLIENT_ID,
    response_type: "code",
    scope: SCOPES,
    state,
    redirect_uri: REDIRECT_URI,
    code_challenge: codeChallenge,
    code_challenge_method: "S256",
  });

  const authUrl = `https://www.pathofexile.com/oauth/authorize?${params}`;

  // 4. Redirect the user to PoE's authorization page
  return NextResponse.redirect(authUrl);
}
