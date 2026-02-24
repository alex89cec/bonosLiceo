"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import Image from "next/image";
import Link from "next/link";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirect = searchParams.get("redirect") || "/seller/dashboard";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const supabase = createClient();
    const { data: authData, error: authError } =
      await supabase.auth.signInWithPassword({
        email,
        password,
      });

    if (authError) {
      setError(authError.message);
      setLoading(false);
      return;
    }

    // Check profile for role and must_change_password
    if (authData.user) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("role, must_change_password")
        .eq("id", authData.user.id)
        .single();

      if (profile?.must_change_password) {
        router.push("/change-password");
        router.refresh();
        return;
      }

      // If no explicit redirect, all users go to seller dashboard
      // (admins access admin panel via the gear icon which sets ?redirect=/admin)
      if (!searchParams.get("redirect")) {
        router.push("/seller/dashboard");
        router.refresh();
        return;
      }
    }

    router.push(redirect);
    router.refresh();
  }

  return (
    <div className="card">
      <form onSubmit={handleLogin} className="space-y-4">
        <div>
          <label
            htmlFor="email"
            className="mb-1.5 block text-sm font-semibold text-navy-700"
          >
            Email
          </label>
          <input
            id="email"
            type="email"
            className="input-field"
            placeholder="tu@email.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoComplete="email"
            inputMode="email"
          />
        </div>

        <div>
          <label
            htmlFor="password"
            className="mb-1.5 block text-sm font-semibold text-navy-700"
          >
            Contraseña
          </label>
          <input
            id="password"
            type="password"
            className="input-field"
            placeholder="••••••••"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            autoComplete="current-password"
          />
        </div>

        {error && (
          <div className="rounded-xl bg-red-50 p-3 text-sm text-red-600">
            {error}
          </div>
        )}

        <button className="btn-primary w-full" disabled={loading}>
          {loading ? (
            <span className="flex items-center gap-2">
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
              Ingresando...
            </span>
          ) : (
            "Ingresar"
          )}
        </button>
      </form>
    </div>
  );
}

export default function LoginPage() {
  return (
    <main className="flex min-h-screen flex-col bg-gray-50">
      {/* Header */}
      <div className="relative bg-navy-700 px-4 pb-6 pt-5">
        <div className="absolute left-0 right-0 top-0 h-1.5 bg-gold-500" />
        <div className="mx-auto max-w-md">
          <div className="flex items-center justify-between">
            <Link
              href="/"
              className="inline-flex items-center gap-1 text-sm text-navy-200 hover:text-white"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-4 w-4"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M15 19l-7-7 7-7"
                />
              </svg>
              Inicio
            </Link>
            {/* Admin access — subtle gear icon */}
            <Link
              href="/login?redirect=/admin"
              className="rounded-lg p-2 text-navy-400 transition hover:bg-navy-600 hover:text-navy-200"
              title="Administración"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-5 w-5"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={1.5}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.325.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.241-.438.613-.43.992a7.723 7.723 0 010 .255c-.008.378.137.75.43.991l1.004.827c.424.35.534.955.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.47 6.47 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.281c-.09.543-.56.94-1.11.94h-2.594c-.55 0-1.019-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.43-.991a6.932 6.932 0 010-.255c.007-.38-.138-.751-.43-.992l-1.004-.827a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.086.22-.128.332-.183.582-.495.644-.869l.214-1.28z"
                />
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                />
              </svg>
            </Link>
          </div>
          <div className="mt-3 flex items-center gap-3">
            <Image
              src="/logo.png"
              alt="CEC Liceo Militar"
              width={120}
              height={31}
              className="drop-shadow"
            />
          </div>
          <h1 className="mt-3 text-xl font-bold text-white">
            Portal Vendedores
          </h1>
          <p className="text-sm text-navy-200">
            Ingresa con tu cuenta de vendedor
          </p>
        </div>
      </div>

      {/* Form */}
      <div className="mx-auto w-full max-w-md px-4 py-6">
        <Suspense
          fallback={
            <div className="card flex items-center justify-center py-12">
              <div className="h-8 w-8 animate-spin rounded-full border-4 border-gold-200 border-t-gold-500" />
            </div>
          }
        >
          <LoginForm />
        </Suspense>
      </div>
    </main>
  );
}
