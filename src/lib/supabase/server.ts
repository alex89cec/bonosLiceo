import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

const SESSION_MAX_AGE = 7 * 24 * 60 * 60; // 7 days in seconds

export async function createServerSupabaseClient() {
  const cookieStore = await cookies();
  const rememberMe = cookieStore.get("remember_me")?.value === "1";

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet: Array<{ name: string; value: string; options?: Record<string, unknown> }>) {
          try {
            cookiesToSet.forEach(({ name, value, options }) => {
              const cookieOptions = { ...options };
              if (rememberMe) {
                cookieOptions.maxAge = SESSION_MAX_AGE;
              } else {
                delete cookieOptions.maxAge;
                delete cookieOptions.expires;
              }
              cookieStore.set(name, value, cookieOptions);
            });
          } catch {
            // Called from Server Component — ignore
          }
        },
      },
    },
  );
}

export function createServiceRoleClient() {
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      cookies: {
        getAll: () => [],
        setAll: () => {},
      },
    },
  );
}
