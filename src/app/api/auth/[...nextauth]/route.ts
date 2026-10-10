import { NextResponse } from "next/server";
import { handlers } from "@/auth";

// Auth.js endpoints (sign-in, callback, session, csrf, sign-out) exist only in Keycloak mode
const keycloakMode = process.env.NEXT_PUBLIC_AUTH_PROVIDER === "keycloak";
const notFound = () => NextResponse.json({ error: "Not found" }, { status: 404 });

export const GET = keycloakMode ? handlers.GET : notFound;
export const POST = keycloakMode ? handlers.POST : notFound;
