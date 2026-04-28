"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";

interface ProfileData {
  id: string;
  role: "admin" | "seller";
  full_name: string;
  email: string;
  phone: string | null;
  seller_code: string | null;
  is_active: boolean;
  is_approver: boolean;
  group_id: string | null;
  seller_groups: { id: string; name: string } | null;
}

const SELLER_CODE_REGEX = /^[A-Z0-9.-]{4,12}$/;

export default function ProfilePage() {
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [pageLoading, setPageLoading] = useState(true);
  const [pageError, setPageError] = useState<string | null>(null);

  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [sellerCode, setSellerCode] = useState("");
  const [originalCode, setOriginalCode] = useState("");

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/profile");
      const json = await res.json();
      if (!res.ok) {
        setPageError(json.error || "Error al cargar perfil");
        setPageLoading(false);
        return;
      }
      const p: ProfileData = json.profile;
      setProfile(p);
      setFullName(p.full_name);
      setPhone(p.phone || "");
      setSellerCode(p.seller_code || "");
      setOriginalCode(p.seller_code || "");
      setPageLoading(false);
    } catch {
      setPageError("Error de red");
      setPageLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!profile) return;

    setError(null);
    setSuccess(false);

    // Client-side validation for seller_code
    if (sellerCode && !SELLER_CODE_REGEX.test(sellerCode)) {
      setError(
        "El código debe tener 4-12 caracteres: letras (A-Z), números, puntos o guiones",
      );
      return;
    }

    // Confirmation if seller_code changed
    if (sellerCode !== originalCode) {
      const ok = confirm(
        `Vas a cambiar tu código de "${originalCode}" a "${sellerCode}".\n\n` +
          `Tus ventas anteriores siguen atadas a tu cuenta, y los links que ` +
          `compartiste con "${originalCode}" se siguen atribuyendo a vos.\n\n` +
          `El código viejo queda reservado para que nadie más lo use.\n\n` +
          `¿Continuar?`,
      );
      if (!ok) return;
    }

    setSaving(true);
    try {
      const body: Record<string, unknown> = {
        full_name: fullName.trim(),
        phone: phone.trim() || null,
      };
      if (sellerCode !== originalCode) {
        body.seller_code = sellerCode;
      }

      const res = await fetch("/api/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = await res.json();

      if (!res.ok) {
        setError(json.error || "Error al guardar");
        setSaving(false);
        return;
      }

      // Reload to refresh state with server values
      await load();
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch {
      setError("Error de red");
    }
    setSaving(false);
  }

  if (pageLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-gold-200 border-t-gold-500" />
      </div>
    );
  }

  if (pageError || !profile) {
    return (
      <div className="py-12 text-center">
        <p className="text-sm text-red-600">{pageError}</p>
        <Link href="/seller/dashboard" className="btn-secondary mt-4 inline-block">
          Volver
        </Link>
      </div>
    );
  }

  const codeChanged = sellerCode !== originalCode;
  const codeIsValid =
    !codeChanged || (sellerCode.length > 0 && SELLER_CODE_REGEX.test(sellerCode));

  return (
    <div>
      <Link
        href="/seller/dashboard"
        className="mb-3 inline-flex items-center gap-1 text-sm text-navy-400 hover:text-navy-700"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          className="h-4 w-4"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
        </svg>
        Volver
      </Link>

      <h2 className="mb-4 text-xl font-bold text-navy-700">Mi perfil</h2>

      <form onSubmit={save} className="space-y-4">
        <div className="card space-y-4">
          {/* Email — read-only */}
          <div>
            <label className="mb-1.5 block text-sm font-semibold text-navy-700">
              Email
            </label>
            <input
              type="email"
              className="input-field bg-gray-50 text-gray-500"
              value={profile.email}
              readOnly
            />
            <p className="mt-1 text-xs text-navy-400">
              No se puede cambiar desde acá. Pedile a un admin si lo necesitás.
            </p>
          </div>

          {/* Full name */}
          <div>
            <label
              htmlFor="fullName"
              className="mb-1.5 block text-sm font-semibold text-navy-700"
            >
              Nombre y apellido
            </label>
            <input
              id="fullName"
              type="text"
              className="input-field"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              autoComplete="name"
              required
            />
          </div>

          {/* Phone */}
          <div>
            <label
              htmlFor="phone"
              className="mb-1.5 block text-sm font-semibold text-navy-700"
            >
              Teléfono <span className="font-normal text-navy-300">(opcional)</span>
            </label>
            <input
              id="phone"
              type="tel"
              className="input-field"
              placeholder="+54 11 1234 5678"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              autoComplete="tel"
              inputMode="tel"
            />
          </div>

          {/* Seller code */}
          <div>
            <label
              htmlFor="sellerCode"
              className="mb-1.5 block text-sm font-semibold text-navy-700"
            >
              Código de venta
            </label>
            <input
              id="sellerCode"
              type="text"
              className="input-field font-mono uppercase"
              placeholder="EJ: ALEX2026"
              value={sellerCode}
              onChange={(e) =>
                setSellerCode(
                  e.target.value
                    .toUpperCase()
                    .replace(/[^A-Z0-9.-]/g, "")
                    .slice(0, 12),
                )
              }
              maxLength={12}
            />
            <p className="mt-1 text-xs text-navy-400">
              4-12 caracteres: letras (A-Z), números, puntos o guiones.
            </p>
            {codeChanged && (
              <div className="mt-2 rounded-xl bg-blue-50 p-2 text-xs text-blue-800">
                ✅ Tus ventas anteriores siguen atadas a tu cuenta y los links
                con tu código viejo se van a seguir atribuyendo a vos. El
                código anterior queda reservado para que nadie más lo use.
              </div>
            )}
            {sellerCode && !codeIsValid && (
              <p className="mt-1 text-xs text-red-600">Formato inválido</p>
            )}
          </div>
        </div>

        {/* Account info — read-only */}
        <div className="card space-y-2">
          <h3 className="mb-2 text-sm font-bold uppercase tracking-wider text-navy-400">
            Cuenta
          </h3>
          <div className="flex items-center justify-between text-sm">
            <span className="text-navy-400">Rol</span>
            <span className="font-semibold text-navy-700">
              {profile.role === "admin" ? "Administrador" : "Vendedor"}
            </span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-navy-400">Validador de órdenes</span>
            <span
              className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                profile.is_approver
                  ? "bg-purple-100 text-purple-700"
                  : "bg-gray-100 text-gray-600"
              }`}
            >
              {profile.is_approver ? "Sí" : "No"}
            </span>
          </div>
          {profile.seller_groups && (
            <div className="flex items-center justify-between text-sm">
              <span className="text-navy-400">Grupo</span>
              <span className="font-semibold text-navy-700">
                {profile.seller_groups.name}
              </span>
            </div>
          )}
          <div className="flex items-center justify-between text-sm">
            <span className="text-navy-400">Estado</span>
            <span
              className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                profile.is_active
                  ? "bg-green-100 text-green-700"
                  : "bg-red-100 text-red-700"
              }`}
            >
              {profile.is_active ? "Activo" : "Inactivo"}
            </span>
          </div>
        </div>

        {/* Password */}
        <div className="card">
          <h3 className="mb-2 text-sm font-bold uppercase tracking-wider text-navy-400">
            Contraseña
          </h3>
          <Link
            href="/change-password"
            className="flex w-full items-center justify-center gap-2 rounded-xl border border-navy-200 px-3 py-2 text-sm font-medium text-navy-600 transition hover:bg-navy-50"
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
                d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
              />
            </svg>
            Cambiar contraseña
          </Link>
        </div>

        {error && (
          <div className="rounded-xl bg-red-50 p-3 text-sm text-red-600">
            {error}
          </div>
        )}
        {success && (
          <div className="rounded-xl bg-green-50 p-3 text-sm text-green-700">
            Cambios guardados.
          </div>
        )}

        <button
          type="submit"
          className="btn-gold w-full"
          disabled={saving || !codeIsValid || !fullName.trim()}
        >
          {saving ? "Guardando..." : "Guardar cambios"}
        </button>
      </form>
    </div>
  );
}
