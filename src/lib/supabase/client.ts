import { createBrowserClient } from "@supabase/ssr";

const SESSION_MAX_AGE = 7 * 24 * 60 * 60;

function hasRememberMe(): boolean {
  if (typeof document === "undefined") return false;
  return document.cookie
    .split("; ")
    .some((c) => c.trim() === "remember_me=1");
}

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    hasRememberMe() ? { cookieOptions: { maxAge: SESSION_MAX_AGE } } : undefined,
  );
}
