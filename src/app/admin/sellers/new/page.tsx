"use client";

import { useState } from "react";
import Link from "next/link";

interface CreatedSeller {
  full_name: string;
  email: string;
  seller_code: string;
  temp_password: string;
  email_sent: boolean;
}

export default function NewSellerPage() {
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [created, setCreated] = useState<CreatedSeller | null>(null);
  const [copied, setCopied] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/sellers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          full_name: fullName.trim(),
          email: email.trim(),
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Error al crear el vendedor");
        setLoading(false);
        return;
      }

      setCreated({
        full_name: data.seller.full_name,
        email: data.seller.email,
        seller_code: data.seller.seller_code,
        temp_password: data.temp_password,
        email_sent: data.email_sent ?? false,
      });
      setLoading(false);
    } catch {
      setError("Error de conexión. Intenta de nuevo.");
      setLoading(false);
    }
  }

  function handleCopyCredentials() {
    if (!created) return;
    const text = `Credenciales de acceso:\nEmail: ${created.email}\nContraseña temporal: ${created.temp_password}\nCódigo vendedor: ${created.seller_code}\n\nIngresa en la plataforma y cambia tu contraseña en el primer inicio de sesión.`;
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 3000);
  }

  function handleCreateAnother() {
    setCreated(null);
    setFullName("");
    setEmail("");
    setError(null);
    setCopied(false);
  }

  // Success view — show credentials
  if (created) {
    return (
      <div>
        <div className="mb-6">
          <Link
            href="/admin/sellers"
            className="mb-2 inline-flex items-center gap-1 text-sm text-navy-400 hover:text-navy-700"
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
            Volver a vendedores
          </Link>
          <h2 className="text-xl font-bold text-navy-700">
            Vendedor creado exitosamente
          </h2>
        </div>

        {/* Success card */}
        <div className="card space-y-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-green-100">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-5 w-5 text-green-600"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M5 13l4 4L19 7"
                />
              </svg>
            </div>
            <div>
              <h3 className="font-semibold text-navy-700">
                {created.full_name}
              </h3>
              <p className="text-sm text-gray-500">{created.email}</p>
            </div>
          </div>

          {/* Email status badge */}
          {created.email_sent ? (
            <div className="flex items-center gap-2 rounded-lg bg-green-50 px-3 py-2 text-sm text-green-700">
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
                  d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
                />
              </svg>
              <span className="font-medium">
                Email de bienvenida enviado a {created.email}
              </span>
            </div>
          ) : (
            <div className="flex items-center gap-2 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-700">
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
                  d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                />
              </svg>
              <span className="font-medium">
                No se pudo enviar el email de bienvenida. Comparte las credenciales manualmente.
              </span>
            </div>
          )}

          {/* Credentials box */}
          <div className="rounded-xl border-2 border-dashed border-amber-300 bg-amber-50 p-4">
            <div className="mb-2 flex items-center gap-2">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-4 w-4 text-amber-600"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                />
              </svg>
              <p className="text-sm font-semibold text-amber-800">
                Guarda estas credenciales — no se mostrarán de nuevo
              </p>
            </div>
            <div className="space-y-2 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-amber-700">Email:</span>
                <span className="font-mono font-semibold text-amber-900">
                  {created.email}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-amber-700">Contraseña temporal:</span>
                <span className="font-mono font-semibold text-amber-900">
                  {created.temp_password}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-amber-700">Código vendedor:</span>
                <span className="font-mono font-semibold text-amber-900">
                  {created.seller_code}
                </span>
              </div>
            </div>
          </div>

          <p className="text-xs text-gray-500">
            El vendedor deberá cambiar su contraseña en el primer inicio de
            sesión.
          </p>

          {/* Actions */}
          <div className="flex gap-3">
            <button onClick={handleCopyCredentials} className="btn-gold flex-1">
              {copied ? (
                <span className="flex items-center justify-center gap-2">
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
                      d="M5 13l4 4L19 7"
                    />
                  </svg>
                  Copiado
                </span>
              ) : (
                <span className="flex items-center justify-center gap-2">
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
                      d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
                    />
                  </svg>
                  Copiar credenciales
                </span>
              )}
            </button>
            <button onClick={handleCreateAnother} className="btn-secondary flex-1">
              Crear otro
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Form view
  return (
    <div>
      {/* Header */}
      <div className="mb-6">
        <Link
          href="/admin/sellers"
          className="mb-2 inline-flex items-center gap-1 text-sm text-navy-400 hover:text-navy-700"
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
          Volver a vendedores
        </Link>
        <h2 className="text-xl font-bold text-navy-700">Nuevo Vendedor</h2>
        <p className="text-sm text-navy-400">
          Ingresa los datos del vendedor. Se generará una contraseña temporal
          automáticamente.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="card space-y-4">
          <h3 className="text-sm font-bold uppercase tracking-wider text-navy-400">
            Datos del vendedor
          </h3>

          <div>
            <label
              htmlFor="fullName"
              className="mb-1.5 block text-sm font-semibold text-navy-700"
            >
              Nombre completo
            </label>
            <input
              id="fullName"
              type="text"
              className="input-field"
              placeholder="ej: Juan Pérez"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              required
              maxLength={200}
              autoComplete="off"
            />
          </div>

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
              placeholder="ej: juan@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="off"
              inputMode="email"
            />
            <p className="mt-1 text-xs text-navy-400">
              Se usará para iniciar sesión
            </p>
          </div>
        </div>

        <div className="rounded-xl bg-navy-50 p-4 text-sm text-navy-600">
          <div className="flex items-start gap-2">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="mt-0.5 h-4 w-4 flex-shrink-0"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            <div>
              <p className="font-semibold">Contraseña temporal</p>
              <p className="mt-0.5 text-navy-400">
                Se generará automáticamente una contraseña segura. El vendedor
                deberá cambiarla en su primer inicio de sesión.
              </p>
            </div>
          </div>
        </div>

        {/* Error */}
        {error && (
          <div className="rounded-xl bg-red-50 p-4 text-sm text-red-600">
            {error}
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-3">
          <Link
            href="/admin/sellers"
            className="btn-secondary flex-1 text-center"
          >
            Cancelar
          </Link>
          <button
            type="submit"
            className="btn-gold flex-1"
            disabled={loading || !fullName || !email}
          >
            {loading ? (
              <span className="flex items-center gap-2">
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-navy-700 border-t-transparent" />
                Creando...
              </span>
            ) : (
              "Crear vendedor"
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
