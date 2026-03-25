import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function updateSession(request: NextRequest) {
  // Bail out gracefully if env vars are missing (avoids Edge Runtime crash)
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    return NextResponse.next({ request });
  }

  let supabaseResponse = NextResponse.next({ request });

  // Check if user opted for "remember me" (7-day session)
  const rememberMe = request.cookies.get("remember_me")?.value === "1";
  const SESSION_MAX_AGE = 7 * 24 * 60 * 60; // 7 days in seconds

  try {
    const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(
          cookiesToSet: Array<{
            name: string;
            value: string;
            options?: Record<string, unknown>;
          }>,
        ) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) => {
            // Apply session persistence based on remember_me preference
            const cookieOptions = { ...options };
            if (rememberMe) {
              cookieOptions.maxAge = SESSION_MAX_AGE;
            } else {
              // Session cookie — expires when browser closes
              delete cookieOptions.maxAge;
              delete cookieOptions.expires;
            }
            supabaseResponse.cookies.set(name, value, cookieOptions);
          });
        },
      },
    });

    const {
      data: { user },
    } = await supabase.auth.getUser();

    // Protect admin and seller routes
    const isProtectedRoute =
      request.nextUrl.pathname.startsWith("/admin") ||
      request.nextUrl.pathname.startsWith("/seller");

    if (isProtectedRoute && !user) {
      const url = request.nextUrl.clone();
      url.pathname = "/login";
      url.searchParams.set("redirect", request.nextUrl.pathname);
      return NextResponse.redirect(url);
    }

    // Check must_change_password for protected routes
    const isChangePasswordPage =
      request.nextUrl.pathname === "/change-password";

    if (user && isProtectedRoute && !isChangePasswordPage) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("must_change_password")
        .eq("id", user.id)
        .single();

      if (profile?.must_change_password) {
        const url = request.nextUrl.clone();
        url.pathname = "/change-password";
        return NextResponse.redirect(url);
      }
    }

    return supabaseResponse;
  } catch (e) {
    // If middleware fails, let the request through rather than crashing
    console.error("Middleware error:", e);
    return NextResponse.next({ request });
  }
}
