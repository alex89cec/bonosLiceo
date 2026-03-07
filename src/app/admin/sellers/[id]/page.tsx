"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import type { Profile } from "@/types/database";

interface CampaignEntry {
  campaign_id: string;
  campaign_name: string;
  campaign_slug: string;
  campaign_status: string;
  assigned: boolean;
  assignment_id: string | null;
  max_tickets: number | null;
  assigned_at: string | null;
  sold_count: number;
}

export default function SellerDetailPage() {
  const router = useRouter();
  const { id } = useParams<{ id: string }>();

  const [pageLoading, setPageLoading] = useState(true);
  const [pageError, setPageError] = useState<string | null>(null);

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [isActive, setIsActive] = useState(true);
  const [campaigns, setCampaigns] = useState<CampaignEntry[]>([]);

  const [sellerRole, setSellerRole] = useState<string>("seller");
  const [sellerCode, setSellerCode] = useState<string>("");
  const [groupId, setGroupId] = useState<string | null>(null);
  const [groups, setGroups] = useState<{ id: string; name: string }[]>([]);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  // Delete state
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

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
        setGroupId(s.group_id || null);
        setCampaigns(data.campaigns || []);
        setGroups(data.groups || []);
        setPageLoading(false);
      } catch {
        setPageError("Error de conexión");
        setPageLoading(false);
      }
    }
    fetchSeller();
  }, [id]);

  // When group changes, fetch that group's campaigns to preview
  async function handleGroupChange(newGroupId: string | null) {
    setGroupId(newGroupId);

    if (!newGroupId) {
      // No group — fetch all campaigns (legacy)
      try {
        const res = await fetch(`/api/sellers/${id}`);
        const data = await res.json();
        if (res.ok) {
          setCampaigns(data.campaigns || []);
        }
      } catch {
        // Silent
      }
      return;
    }

    // Fetch group detail to get assigned campaigns
    try {
      const res = await fetch(`/api/groups/${newGroupId}`);
      const data = await res.json();
      if (res.ok) {
        const groupCampaigns: CampaignEntry[] = (data.assigned_campaigns || []).map(
          (c: { id: string; name: string; slug: string; status: string }) => ({
            campaign_id: c.id,
            campaign_name: c.name,
            campaign_slug: c.slug,
            campaign_status: c.status,
            assigned: true,
            assignment_id: null,
            max_tickets: null,
            assigned_at: null,
            sold_count: 0,
          }),
        );
        setCampaigns(groupCampaigns);
      }
    } catch {
      // Silent
    }
  }

  async function handleDelete() {
    setDeleteLoading(true);
    setDeleteError(null);
    try {
      const res = await fetch(`/api/sellers/${id}`, { method: "DELETE" });
      const data = await res.json();
      if (res.ok) {
        router.push("/admin/sellers");
        router.refresh();
      } else {
        setDeleteError(data.error || "Error al desactivar el vendedor");
      }
    } catch {
      setDeleteError("Error de conexión");
    }
    setDeleteLoading(false);
  }

  function toggleCampaign(campaignId: string, assigned: boolean) {
    setCampaigns((prev) =>
      prev.map((c) =>
        c.campaign_id === campaignId ? { ...c, assigned } : c,
      ),
    );
  }

  function updateMaxTickets(campaignId: string, value: number | null) {
    setCampaigns((prev) =>
      prev.map((c) =>
        c.campaign_id === campaignId ? { ...c, max_tickets: value } : c,
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
    body.group_id = groupId;
    body.campaigns = campaigns.map((c) => ({
      campaign_id: c.campaign_id,
      assigned: c.assigned,
      max_tickets: c.max_tickets,
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
      setError("Error de conexión");
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
              Nueva contraseña
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
              Mínimo 8 caracteres. Solo completar si desea cambiar la contraseña.
            </p>
          </div>

          <div>
            <label className="flex cursor-pointer items-center justify-between">
              <div>
                <p className="text-sm font-semibold text-navy-700">
                  Usuario activo
                </p>
                <p className="text-xs text-navy-400">
                  Los usuarios inactivos no pueden iniciar sesión ni vender
                </p>
              </div>
              <span className="toggle-slider">
                <input
                  className="sr-only"
                  type="checkbox"
                  checked={isActive}
                  onChange={(e) => setIsActive(e.target.checked)}
                />
                <span className="slider" />
              </span>
            </label>
          </div>
        </div>

        {/* Group assignment — only for sellers */}
        {sellerRole === "seller" && groups.length > 0 && (
          <div className="card space-y-4">
            <h3 className="text-sm font-bold uppercase tracking-wider text-navy-400">
              Grupo
            </h3>
            <div>
              <label
                htmlFor="groupSelect"
                className="mb-1.5 block text-sm font-semibold text-navy-700"
              >
                Grupo asignado
              </label>
              <select
                id="groupSelect"
                className="input-field"
                value={groupId || ""}
                onChange={(e) => handleGroupChange(e.target.value || null)}
              >
                <option value="">Sin grupo</option>
                {groups.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.name}
                  </option>
                ))}
              </select>
              <p className="mt-1 text-xs text-navy-400">
                Al cambiar de grupo, las campañas del grupo se asignarán automáticamente.
              </p>
            </div>
          </div>
        )}

        {/* Campaign assignments */}
        <div className="card space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold uppercase tracking-wider text-navy-400">
              Campañas
            </h3>
            {groupId && (
              <span className="rounded-full bg-blue-50 px-2.5 py-0.5 text-xs font-medium text-blue-600">
                Gestionadas por grupo
              </span>
            )}
          </div>

          {groupId && (
            <p className="text-xs text-navy-400">
              Las campañas se asignan desde el{" "}
              <Link href={`/admin/groups/${groupId}`} className="font-semibold text-blue-600 hover:underline">
                grupo
              </Link>
              . Solo se muestran las del grupo.
            </p>
          )}

          {campaigns.length > 0 ? (
            <div className="space-y-3">
              {campaigns.map((c) => {
                const hasLimit = c.assigned && c.max_tickets !== null;
                const progress = hasLimit
                  ? Math.min((c.sold_count / c.max_tickets!) * 100, 100)
                  : 0;
                const atLimit = hasLimit && c.sold_count >= c.max_tickets!;
                // If seller has a group, campaign toggles are read-only
                const isGroupManaged = !!groupId;

                return (
                  <div
                    key={c.campaign_id}
                    className={`rounded-xl border p-4 transition-all ${
                      c.assigned
                        ? "border-gold-200 bg-white"
                        : "border-navy-100 bg-navy-50/50"
                    }`}
                  >
                    {/* Campaign header with toggle */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <p
                          className={`font-semibold ${
                            c.assigned ? "text-navy-700" : "text-navy-400"
                          }`}
                        >
                          {c.campaign_name}
                        </p>
                        <span
                          className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                            c.campaign_status === "active"
                              ? "bg-green-100 text-green-700"
                              : c.campaign_status === "sorted"
                                ? "bg-purple-100 text-purple-700"
                                : c.campaign_status === "draft"
                                  ? "bg-yellow-100 text-yellow-700"
                                  : "bg-gray-100 text-gray-700"
                          }`}
                        >
                          {c.campaign_status === "active"
                            ? "Activa"
                            : c.campaign_status === "sorted"
                              ? "Sorteada"
                              : c.campaign_status === "draft"
                                ? "Borrador"
                                : "Cerrada"}
                        </span>
                      </div>
                      {!isGroupManaged && (
                        <div className="flex items-center gap-2">
                          {c.assigned && c.sold_count > 0 && (
                            <span
                              className="text-xs text-navy-400"
                              title="No se puede desasignar: tiene ventas activas"
                            >
                              🔒
                            </span>
                          )}
                          <span className="toggle-slider">
                            <input
                              className="sr-only"
                              type="checkbox"
                              checked={c.assigned}
                              disabled={c.assigned && c.sold_count > 0}
                              onChange={(e) =>
                                toggleCampaign(c.campaign_id, e.target.checked)
                              }
                            />
                            <span
                              className={`slider ${c.assigned && c.sold_count > 0 ? "opacity-50 cursor-not-allowed" : ""}`}
                            />
                          </span>
                        </div>
                      )}
                    </div>
                    {!isGroupManaged && c.assigned && c.sold_count > 0 && (
                      <p className="mt-1 text-right text-xs text-navy-400">
                        No se puede desasignar (tiene {c.sold_count} venta
                        {c.sold_count > 1 ? "s" : ""})
                      </p>
                    )}

                    {/* Details shown only when assigned */}
                    {c.assigned && (
                      <div className="mt-3 space-y-2">
                        {/* Sold count */}
                        <div className="text-sm text-navy-500">
                          <span className="font-bold text-navy-700">
                            {c.sold_count}
                          </span>
                          {hasLimit ? (
                            <>
                              {" "}
                              / {c.max_tickets} vendidos
                              {atLimit && (
                                <span className="ml-2 font-semibold text-red-600">
                                  (Límite alcanzado)
                                </span>
                              )}
                            </>
                          ) : (
                            <> vendidos — Sin límite</>
                          )}
                        </div>

                        {/* Progress bar */}
                        {hasLimit && (
                          <div className="h-2 overflow-hidden rounded-full bg-navy-100">
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
                            Límite de ventas:
                          </label>
                          <input
                            type="number"
                            className="input-field w-28 !py-1.5 text-sm"
                            placeholder="Sin límite"
                            min={1}
                            value={c.max_tickets ?? ""}
                            onChange={(e) => {
                              const val = e.target.value;
                              updateMaxTickets(
                                c.campaign_id,
                                val === "" ? null : parseInt(val, 10),
                              );
                            }}
                          />
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="py-4 text-center text-sm text-navy-400">
              {groupId
                ? "El grupo no tiene campañas asignadas"
                : "No hay campañas creadas"}
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

        {/* Delete seller */}
        {sellerRole === "seller" && (
          <div className="mt-6 card space-y-3 border-red-200">
            {!showDeleteConfirm ? (
              <button
                type="button"
                className="w-full rounded-xl border-2 border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-600 transition hover:bg-red-100"
                onClick={() => setShowDeleteConfirm(true)}
              >
                Desactivar vendedor
              </button>
            ) : (
              <div className="space-y-3">
                <p className="text-sm text-red-700">
                  Se desactivará el vendedor y será removido de su grupo.
                  No podrá acceder al sistema hasta ser reactivado.
                </p>
                {deleteError && (
                  <p className="text-sm text-red-600">{deleteError}</p>
                )}
                <div className="flex gap-2">
                  <button
                    type="button"
                    className="btn-secondary flex-1"
                    onClick={() => setShowDeleteConfirm(false)}
                    disabled={deleteLoading}
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    className="flex-1 rounded-xl bg-red-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-red-700 disabled:opacity-50"
                    onClick={handleDelete}
                    disabled={deleteLoading}
                  >
                    {deleteLoading ? (
                      <span className="flex items-center justify-center gap-2">
                        <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                        Desactivando...
                      </span>
                    ) : (
                      "Confirmar desactivación"
                    )}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </form>
    </div>
  );
}
