/**
 * Authenticated API Fetch Utility for "Build & Defend" Frontend.
 * Automatically attaches Clerk JWT Session Bearer Token in HTTP Authorization Header.
 */

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:5000";

export async function authenticatedFetch(
  endpoint: string,
  options: RequestInit = {},
  getToken?: () => Promise<string | null>
): Promise<Response> {
  const url = endpoint.startsWith("http") ? endpoint : `${API_BASE_URL}${endpoint}`;
  const headers = new Headers(options.headers || {});

  if (!headers.has("Content-Type") && !(options.body instanceof FormData)) {
    headers.set("Content-Type", "application/json");
  }

  // Attach Clerk JWT Bearer Token if available
  if (getToken) {
    try {
      const token = await getToken();
      if (token) {
        headers.set("Authorization", `Bearer ${token}`);
      }
    } catch (error) {
      console.warn("[API CLIENT] Could not retrieve Clerk JWT token:", error);
    }
  }

  return fetch(url, {
    ...options,
    headers,
  });
}
