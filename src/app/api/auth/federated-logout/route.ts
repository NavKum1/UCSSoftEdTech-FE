import { NextRequest, NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";
import { keycloakClientId, keycloakIssuer } from "@/auth";

// Ends the Keycloak SSO session too (RP-initiated logout), then clears the Auth.js session cookies.
// Signing out of Auth.js alone would leave the Keycloak session alive and sign the user straight back in.
export async function GET(req: NextRequest) {
  if (process.env.NEXT_PUBLIC_AUTH_PROVIDER !== "keycloak") {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  const secureCookie = req.nextUrl.protocol === "https:" || (process.env.AUTH_URL ?? "").startsWith("https:");
  const token = await getToken({ req, secret: process.env.AUTH_SECRET, secureCookie });

  const postLogout = new URL("/login", req.nextUrl.origin).toString();
  const endSession = new URL(`${keycloakIssuer}/protocol/openid-connect/logout`);
  endSession.searchParams.set("client_id", keycloakClientId);
  endSession.searchParams.set("post_logout_redirect_uri", postLogout);
  if (token?.idToken) endSession.searchParams.set("id_token_hint", token.idToken);

  const res = NextResponse.redirect(token ? endSession : new URL(postLogout));
  for (const cookie of req.cookies.getAll()) {
    if (/^(__Secure-|__Host-)?authjs\.(session-token|callback-url|csrf-token)(\.\d+)?$/.test(cookie.name)) {
      res.cookies.set(cookie.name, "", { maxAge: 0, path: "/", secure: cookie.name.startsWith("__") });
    }
  }
  return res;
}
