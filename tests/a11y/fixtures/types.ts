/**
 * Mocked API responses for the accessibility suite. Every request the browser sends to the API base
 * (NEXT_PUBLIC_API_URL) is answered from these lists; nothing reaches a real backend.
 */

export type Persona = "student" | "career-center" | "employer" | "faculty" | "alumni" | "admin" | "public";

export interface FixtureContext {
  url: URL;
  method: string;
  persona: Persona;
  postData: string | null;
}

export interface ApiFixture {
  /** HTTP method, GET by default. Use "*" for any method. */
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE" | "*";
  /** Path after the API base without the query string. A string matches exactly; a RegExp is tested against the path. */
  path: string | RegExp;
  /** Only answer when this returns true (e.g. to vary by query string). */
  when?: (ctx: FixtureContext) => boolean;
  status?: number;
  /** JSON body (or text when contentType is not JSON), or a function of the request. */
  body: unknown | ((ctx: FixtureContext) => unknown);
  contentType?: string;
}

export interface A11yRoute {
  /** Short unique name used in test titles and reports */
  name: string;
  /** App path to open, including query/hash if needed */
  path: string;
  persona: Persona;
  /** Optional selector or text that must be visible before scanning (defaults to the first h1) */
  ready?: string;
}

/** Dates relative to now so "upcoming"/"overdue" branches render the same way on any day. */
export const days = (n: number) => new Date(Date.now() + n * 86_400_000).toISOString();
export const hours = (n: number) => new Date(Date.now() + n * 3_600_000).toISOString();

export const INSTITUTE_ID = "11111111-1111-4111-8111-111111111111";
export const SCHOOL_NAME = "Lakeside State University";
export const USER_ID = "22222222-2222-4222-8222-222222222222";
export const EMPLOYER_ID = "33333333-3333-4333-8333-333333333333";
