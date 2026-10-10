/**
 * Auth.js (next-auth v5) configuration for NEXT_PUBLIC_AUTH_PROVIDER=keycloak.
 * Authorization code + PKCE (S256) against the public `edulexa-web` client of the TotalOffice Keycloak realm. Tokens live
 * in the encrypted, httpOnly Auth.js session cookie; the access token is refreshed here before it expires and handed to
 * the browser through the session so useAppAuth().getToken() can call the API.
 *
 * Env: AUTH_SECRET, AUTH_KEYCLOAK_ISSUER (e.g. http://localhost:8081/realms/totaloffice), AUTH_KEYCLOAK_ID (edulexa-web),
 * optional AUTH_KEYCLOAK_SECRET (only if the client is made confidential), AUTH_URL / AUTH_TRUST_HOST behind a proxy.
 */
import NextAuth from "next-auth";
import type { JWT } from "next-auth/jwt";
import Keycloak from "next-auth/providers/keycloak";

const issuer = process.env.AUTH_KEYCLOAK_ISSUER ?? "http://localhost:8081/realms/totaloffice";
const clientId = process.env.AUTH_KEYCLOAK_ID ?? "edulexa-web";
const clientSecret = process.env.AUTH_KEYCLOAK_SECRET;
// Refresh a little early so a token handed to the browser is still valid when it reaches the API
const REFRESH_MARGIN_SECONDS = 30;

declare module "next-auth" {
  interface Session {
    accessToken?: string;
    accessTokenExpires?: number;
    roles: string[];
    error?: "RefreshTokenError";
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    accessToken?: string;
    accessTokenExpires?: number;
    refreshToken?: string;
    idToken?: string;
    roles?: string[];
    error?: "RefreshTokenError";
  }
}

// Flat `roles` claim from the realm (see infrastructure/keycloak), falling back to realm_access.roles
export function rolesFromAccessToken(accessToken: string | undefined): string[] {
  if (!accessToken) return [];
  try {
    // atob + TextDecoder: also runs in the Edge middleware
    const b64 = accessToken.split(".")[1].replace(/-/g, "+").replace(/_/g, "/");
    const bytes = Uint8Array.from(atob(b64.padEnd(Math.ceil(b64.length / 4) * 4, "=")), (c) => c.charCodeAt(0));
    const payload = JSON.parse(new TextDecoder().decode(bytes)) as {
      roles?: unknown;
      realm_access?: { roles?: unknown };
    };
    const roles = Array.isArray(payload.roles) ? payload.roles : Array.isArray(payload.realm_access?.roles) ? payload.realm_access.roles : [];
    return roles.filter((r): r is string => typeof r === "string");
  } catch {
    return [];
  }
}

async function refreshAccessToken(token: JWT): Promise<JWT> {
  if (!token.refreshToken) return { ...token, error: "RefreshTokenError" };
  try {
    const body = new URLSearchParams({ grant_type: "refresh_token", client_id: clientId, refresh_token: token.refreshToken });
    if (clientSecret) body.set("client_secret", clientSecret);
    const res = await fetch(`${issuer}/protocol/openid-connect/token`, { method: "POST", body });
    const refreshed = (await res.json()) as { access_token?: string; expires_in?: number; refresh_token?: string; id_token?: string };
    if (!res.ok || !refreshed.access_token) throw new Error(`refresh failed (${res.status})`);
    return {
      ...token,
      accessToken: refreshed.access_token,
      accessTokenExpires: Math.floor(Date.now() / 1000) + (refreshed.expires_in ?? 300),
      refreshToken: refreshed.refresh_token ?? token.refreshToken,
      idToken: refreshed.id_token ?? token.idToken,
      roles: rolesFromAccessToken(refreshed.access_token),
      error: undefined,
    };
  } catch {
    // Session ended at Keycloak (logout elsewhere, idle timeout): the UI treats the user as signed out
    return { ...token, accessToken: undefined, error: "RefreshTokenError" };
  }
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [
    Keycloak({
      issuer,
      clientId,
      clientSecret,
      client: clientSecret ? undefined : { token_endpoint_auth_method: "none" },
      checks: ["pkce", "state"],
      authorization: { params: { scope: "openid profile email organization" } },
    }),
  ],
  session: { strategy: "jwt" },
  pages: { signIn: "/login" },
  callbacks: {
    async jwt({ token, account }) {
      if (account) {
        return {
          ...token,
          accessToken: account.access_token,
          accessTokenExpires: account.expires_at ?? Math.floor(Date.now() / 1000) + 300,
          refreshToken: account.refresh_token,
          idToken: account.id_token,
          roles: rolesFromAccessToken(account.access_token),
          error: undefined,
        };
      }
      if (token.accessTokenExpires && Date.now() / 1000 < token.accessTokenExpires - REFRESH_MARGIN_SECONDS) {
        return token;
      }
      return refreshAccessToken(token);
    },
    async session({ session, token }) {
      session.accessToken = token.accessToken;
      session.accessTokenExpires = token.accessTokenExpires;
      session.roles = token.roles ?? [];
      session.error = token.error;
      if (token.sub && session.user) session.user.id = token.sub;
      return session;
    },
  },
});

export const keycloakIssuer = issuer;
export const keycloakClientId = clientId;
