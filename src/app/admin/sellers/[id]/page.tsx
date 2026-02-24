"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import type { Profile } from "@/types/database";

interface CampaignAssignment {
  id: string;
  campaign_id: string;
  max_tickets: number | null;
  assigned_at: string;
  sold_count: number;
  campaigns: {
    id: string;
    name: string;
    slug: string;
    status: string;
  };
}

export default function SellerDetailPage() {
  const { id } = useParams<{ id: string }>();

  const [pageLoading, setPageLoading] = useState(true);
  const [pageError, setPageError] = useState<string | null>(null);

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [isActive, setIsActive] = useState(true);
  const [assignments, setAssignments] = useState<CampaignAssignment[]>([]);

  const [sellerRole, setSellerRole] = useState<string>("seller");
  const [sellerCode, setSellerCode] = useState<string>("");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    async function fetchSeller() {
      try {
        const res = await fetch(`/api/sellers/${id}`);
        const data = await res.json();
        if (!res.ok) {
          setPageError(data.error || "Error al cargar");
          setPageLoading(false);
          return;
        }

        const s: Profile = data.seller;
        setFullName(s.full_name);
        setEmail(s.email);
        setIsActive(s.is_active);
        setSellerRole(s.role);
        setSellerCode(s.seller_code || "");
        setAssignments(data.assignments || []);
        setPageLoading(false);
      } catch {
        setPageError("Error de conexion");
        setPageLoading(false);
      }
    }
    fetchSeller();
  }, [id]);

  function updateMaxTickets(campaignId: string, value: number | null) {
    setAssignments((prev) =>
      prev.map((a) =>
        a.campaign_id === campaignId ? { ...a, max_tickets: value } : a,
      ),
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(false);

    const body: Record<string, unknown> = {
      full_name: fullName.trim(),
      email: email.trim(),
      is_active: isActive,
    };
    if (newPassword) body.new_password = newPassword;
    body.assignments = assignments.map((a) => ({
      campaign_id: a.campaign_id,
      max_tickets: a.max_tickets,
    }));

    try {
      const res = await fetch(`/api/sellers/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Error al guardar");
        setLoading(false);
        return;
      }
      setSuccess(true);
      setNewPassword("");
      setLoading(false);
    } catch {
      setError("Error de conexion");
      setLoading(false);
    }
  }

  // Loading
  if (pageLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-gold-200 border-t-gold-500" />
      </div>
    );
  }

  // Error
  if (pageError) {
    return (
      <div className="py-12 text-center">
        <p className="text-red-600">{pageError}</p>
        <Link href="/admin/sellers" className="btn-secondary mt-4 inline-block">
          Volver
        </Link>
      </div>
    );
  }

  return (
    <div>
      {/* Back link */}
      <Link
        href="/admin/sellers"
        className="mb-4 inline-flex items-center gap-1 text-sm text-navy-400 hover:text-navy-700"
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

      {/* Header */}
      <div className="mb-6 flex items-center gap-3">
        <h2 className="text-xl font-bold">{fullName}</h2>
        <span
          className={`rounded-full px-2 py-0.5 text-xs font-medium ${
            sellerRole === "admin"
              ? "bg-navy-100 text-navy-600"
              : "bg-gold-100 text-gold-700"
          }`}
        >
          {sellerRole === "admin" ? "Admin" : "Vendedor"}
        </span>
        {sellerCode && (
          <span className="rounded-lg bg-navy-50 px-3 py-1 font-mono text-sm font-semibold text-navy-600">
            {sellerCode}
          </span>
        )}
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Profile edit card */}
        <div className="card space-y-4">
          <h3 className="text-sm font-bold uppercase tracking-wider text-navy-400">
            Datos del perfil
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
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              required
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
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>

          <div>
            <label
              htmlFor="newPassword"
              className="mb-1.5 block text-sm font-semibold text-navy-700"
            >
              Nueva contrasena
            </label>
            <input
              id="newPassword"
              type="password"
              className="input-field"
              placeholder="Dejar vacio para no cambiar"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              minLength={8}
            />
            <p className="mt-1 text-xs text-navy-400">
              Minimo 8 caracteres. Solo completar si desea cambiar la contrasena.
            </p>
          </div>

          <div>
            <label className="flex cursor-pointer items-center justify-between">
              <div>
                <p className="text-sm font-semibold text-navy-700">
                  Usuario activo
                </p>
                <p className="text-xs text-navy-400">
                  Los usuarios inactivos no pueden iniciar sesion ni vender
                </p>
              </div>
              <span className="toggle-slider">
                <input
                  type="checkbox"
                  checked={isActive}
                  onChange={(e) => setIsActive(e.target.checked)}
                />
                <span className="slider" />
              </span>
            </label>
          </div>
        </div>

        {/* Campaign assignments */}
        <div className="card space-y-4">
          <h3 className="text-sm font-bold uppercase tracking-wider text-navy-400">
            Campanas asignadas
          </h3>

          {assignments.length > 0 ? (
            <div className="space-y-3">
              {assignments.map((a) => {
                const campaign = a.campaigns;
                if (!campaign) return null;

                const hasLimit = a.max_tickets !== null;
                const progress = hasLimit
                  ? Math.min((a.sold_count / a.max_tickets!) * 100, 100)
                  : 0;
                const atLimit = hasLimit && a.sold_count >= a.max_tickets!;

                return (
                  <div
                    key={a.id}
                    className="rounded-xl border border-navy-100 bg-white p-4"
                  >
                    <div className="mb-2 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <p className="font-semibold text-navy-700">
                          {campaign.name}
                        </p>
                        <span
                          className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                            campaign.status === "active"
                              ? "bg-green-100 text-green-700"
                              : campaign.status === "draft"
                                ? "bg-yellow-100 text-yellow-700"
                                : "bg-gray-100 text-gray-700"
                          }`}
                        >
                          {campaign.status === "active"
                            ? "Activa"
                            : campaign.status === "draft"
                              ? "Borrador"
                              : "Cerrada"}
                        </span>
                      </div>
                    </div>

                    {/* Sold count */}
                    <div className="mb-2 text-sm text-navy-500">
                      <span className="font-bold text-navy-700">
                        {a.sold_count}
                      </span>
                      {hasLimit ? (
                        <>
                          {" "}
                          / {a.max_tickets} vendidos
                          {atLimit && (
                            <span className="ml-2 font-semibold text-red-600">
                              (Limite alcanzado)
                            </span>
                          )}
                        </>
                      ) : (
                        <> vendidos — Sin limite</>
                      )}
                    </div>

                    {/* Progress bar */}
                    {hasLimit && (
                      <div className="mb-3 h-2 overflow-hidden rounded-full bg-navy-100">
                        <div
                          className={`h-full rounded-full transition-all ${
                            atLimit ? "bg-red-500" : "bg-gold-500"
                          }`}
                          style={{ width: `${progress}%` }}
                        />
                      </div>
                    )}

                    {/* Max tickets input */}
                    <div className="flex items-center gap-3">
                      <label className="text-xs font-medium text-navy-500">
                        Limite de ventas:
                      </label>
                      <input
                        type="number"
                        className="input-field w-28 !py-1.5 text-sm"
                        placeholder="Sin limite"
                        min={1}
                        value={a.max_tickets ?? ""}
                        onChange={(e) => {
                          const val = e.target.value;
                          updateMaxTickets(
                            a.campaign_id,
                            val === "" ? null : parseInt(val, 10),
                          );
                        }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="py-4 text-center text-sm text-navy-400">
              Sin campanas asignadas
            </p>
          )}
        </div>

        {/* Error / success */}
        {error && (
          <div className="rounded-xl bg-red-50 p-3 text-sm text-red-600">
            {error}
          </div>
        )}
        {success && (
          <div className="rounded-xl bg-green-50 p-3 text-sm text-green-700">
            Cambios guardados correctamente
          </div>
        )}

        {/* Submit */}
        <div className="flex gap-3">
          <Link href="/admin/sellers" className="btn-secondary flex-1 text-center">
            Cancelar
          </Link>
          <button className="btn-primary flex-1" disabled={loading}>
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                Guardando...
              </span>
            ) : (
              "Guardar cambios"
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
