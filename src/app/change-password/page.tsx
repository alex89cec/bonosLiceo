"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";

export default function ChangePasswordPage() {
  const router = useRouter();
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (newPassword.length < 8) {
      setError("La contraseña debe tener al menos 8 caracteres");
      return;
    }

    if (newPassword !== confirmPassword) {
      setError("Las contraseñas no coinciden");
      return;
    }

    setLoading(true);

    try {
      const res = await fetch("/api/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ new_password: newPassword }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Error al cambiar la contraseña");
        setLoading(false);
        return;
      }

      // Redirect to seller dashboard (or admin)
      router.push("/seller/dashboard");
      router.refresh();
    } catch {
      setError("Error de conexión. Intenta de nuevo.");
      setLoading(false);
    }
  }

  return (
    <main className="flex min-h-screen flex-col bg-gray-50">
      {/* Header */}
      <div className="relative bg-navy-700 px-4 pb-6 pt-5">
        <div className="absolute left-0 right-0 top-0 h-1.5 bg-gold-500" />
        <div className="mx-auto max-w-md">
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
            Cambiar Contraseña
          </h1>
          <p className="text-sm text-navy-200">
            Debes cambiar tu contraseña temporal antes de continuar
          </p>
        </div>
      </div>

      {/* Form */}
      <div className="mx-auto w-full max-w-md px-4 py-6">
        <div className="card">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label
                htmlFor="newPassword"
                className="mb-1.5 block text-sm font-semibold text-navy-700"
              >
                Nueva contraseña
              </label>
              <input
                id="newPassword"
                type="password"
                className="input-field"
                placeholder="Mínimo 8 caracteres"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                required
                minLength={8}
                autoComplete="new-password"
              />
            </div>

            <div>
              <label
                htmlFor="confirmPassword"
                className="mb-1.5 block text-sm font-semibold text-navy-700"
              >
                Confirmar contraseña
              </label>
              <input
                id="confirmPassword"
                type="password"
                className="input-field"
                placeholder="Repite la contraseña"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                minLength={8}
                autoComplete="new-password"
              />
            </div>

            {error && (
              <div className="rounded-xl bg-red-50 p-3 text-sm text-red-600">
                {error}
              </div>
            )}

            <button className="btn-gold w-full" disabled={loading}>
              {loading ? (
                <span className="flex items-center gap-2">
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-navy-700 border-t-transparent" />
                  Guardando...
                </span>
              ) : (
                "Cambiar contraseña"
              )}
            </button>
          </form>
        </div>
      </div>
    </main>
  );
}
