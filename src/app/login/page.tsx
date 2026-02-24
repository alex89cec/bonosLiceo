"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import Image from "next/image";
import Link from "next/link";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirect = searchParams.get("redirect") || "/admin";

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

    // Check if user must change password
    if (authData.user) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("must_change_password")
        .eq("id", authData.user.id)
        .single();

      if (profile?.must_change_password) {
        router.push("/change-password");
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
          <Link
            href="/"
            className="mb-4 inline-flex items-center gap-1 text-sm text-navy-200 hover:text-white"
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
          <div className="flex items-center gap-3">
            <Image
              src="/logo.png"
              alt="CEC Liceo Militar"
              width={120}
              height={31}
              className="drop-shadow"
            />
          </div>
          <h1 className="mt-3 text-xl font-bold text-white">
            Panel de Control
          </h1>
          <p className="text-sm text-navy-200">
            Ingresa con tu cuenta de administrador o vendedor
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
