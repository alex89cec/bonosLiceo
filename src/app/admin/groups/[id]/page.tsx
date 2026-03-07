"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";

interface Member {
  id: string;
  full_name: string;
  email: string;
  seller_code: string;
  is_active: boolean;
}

interface AssignedCampaign {
  assignment_id: string;
  assigned_at: string;
  id: string;
  name: string;
  slug: string;
  status: string;
}

interface CampaignOption {
  id: string;
  name: string;
  slug: string;
  status: string;
}

export default function GroupDetailPage() {
  const { id } = useParams<{ id: string }>();

  const [pageLoading, setPageLoading] = useState(true);
  const [pageError, setPageError] = useState<string | null>(null);

  const [groupName, setGroupName] = useState("");
  const [adminName, setAdminName] = useState("");
  const [members, setMembers] = useState<Member[]>([]);
  const [assignedCampaigns, setAssignedCampaigns] = useState<AssignedCampaign[]>([]);
  const [allCampaigns, setAllCampaigns] = useState<CampaignOption[]>([]);
  const [availableSellers, setAvailableSellers] = useState<Member[]>([]);

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Add member
  const [selectedSeller, setSelectedSeller] = useState("");
  const [addingMember, setAddingMember] = useState(false);

  // Add campaign
  const [selectedCampaign, setSelectedCampaign] = useState("");
  const [addingCampaign, setAddingCampaign] = useState(false);

  // Edit name
  const [editName, setEditName] = useState("");
  const [editingName, setEditingName] = useState(false);

  useEffect(() => {
    fetchGroup();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  async function fetchGroup() {
    try {
      const res = await fetch(`/api/groups/${id}`);
      const data = await res.json();
      if (!res.ok) {
        setPageError(data.error || "Error al cargar");
        setPageLoading(false);
        return;
      }

      setGroupName(data.group.name);
      setEditName(data.group.name);
      setAdminName(data.group.admin?.full_name || "—");
      setMembers(data.members || []);
      setAssignedCampaigns(data.assigned_campaigns || []);
      setAllCampaigns(data.all_campaigns || []);
      setAvailableSellers(data.available_sellers || []);
      if (data.available_sellers?.length > 0) {
        setSelectedSeller(data.available_sellers[0].id);
      }
      setPageLoading(false);
    } catch {
      setPageError("Error de conexión");
      setPageLoading(false);
    }
  }

  // Campaigns not yet assigned to this group
  const unassignedCampaigns = allCampaigns.filter(
    (c) => !assignedCampaigns.some((ac) => ac.id === c.id),
  );

  useEffect(() => {
    if (unassignedCampaigns.length > 0 && !selectedCampaign) {
      setSelectedCampaign(unassignedCampaigns[0].id);
    }
  }, [unassignedCampaigns, selectedCampaign]);

  async function handleAddMember() {
    if (!selectedSeller) return;
    setAddingMember(true);
    setError(null);
    setSuccess(null);

    try {
      const res = await fetch(`/api/groups/${id}/members`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ seller_id: selectedSeller }),
      });
      const data = await res.json();
      if (res.ok) {
        setSuccess("Miembro agregado");
        await fetchGroup();
      } else {
        setError(data.error || "Error al agregar miembro");
      }
    } catch {
      setError("Error de conexión");
    }
    setAddingMember(false);
  }

  async function handleRemoveMember(sellerId: string) {
    setError(null);
    setSuccess(null);

    try {
      const res = await fetch(`/api/groups/${id}/members`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ seller_id: sellerId }),
      });
      const data = await res.json();
      if (res.ok) {
        setSuccess("Miembro removido");
        await fetchGroup();
      } else {
        setError(data.error || "Error al remover miembro");
      }
    } catch {
      setError("Error de conexión");
    }
  }

  async function handleAddCampaign() {
    if (!selectedCampaign) return;
    setAddingCampaign(true);
    setError(null);
    setSuccess(null);

    try {
      const res = await fetch(`/api/groups/${id}/campaigns`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ campaign_id: selectedCampaign }),
      });
      const data = await res.json();
      if (res.ok) {
        setSuccess("Campaña asignada al grupo");
        setSelectedCampaign("");
        await fetchGroup();
      } else {
        setError(data.error || "Error al asignar campaña");
      }
    } catch {
      setError("Error de conexión");
    }
    setAddingCampaign(false);
  }

  async function handleRemoveCampaign(campaignId: string) {
    setError(null);
    setSuccess(null);

    try {
      const res = await fetch(`/api/groups/${id}/campaigns`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ campaign_id: campaignId }),
      });
      const data = await res.json();
      if (res.ok) {
        setSuccess("Campaña removida del grupo");
        await fetchGroup();
      } else {
        setError(data.error || "Error al remover campaña");
      }
    } catch {
      setError("Error de conexión");
    }
  }

  async function handleSaveName() {
    if (!editName.trim() || editName.trim() === groupName) {
      setEditingName(false);
      return;
    }
    setSaving(true);
    setError(null);
    setSuccess(null);

    try {
      const res = await fetch(`/api/groups/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: editName.trim() }),
      });
      const data = await res.json();
      if (res.ok) {
        setGroupName(editName.trim());
        setEditingName(false);
        setSuccess("Nombre actualizado");
      } else {
        setError(data.error || "Error al actualizar");
      }
    } catch {
      setError("Error de conexión");
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

  if (pageError) {
    return (
      <div className="py-12 text-center">
        <p className="text-red-600">{pageError}</p>
        <Link href="/admin/groups" className="btn-secondary mt-4 inline-block">
          Volver
        </Link>
      </div>
    );
  }

  return (
    <div>
      {/* Back link */}
      <Link
        href="/admin/groups"
        className="mb-4 inline-flex items-center gap-1 text-sm text-navy-400 hover:text-navy-700"
      >
        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
        </svg>
        Volver a grupos
      </Link>

      {/* Header */}
      <div className="mb-6">
        {editingName ? (
          <div className="flex items-center gap-2">
            <input
              type="text"
              className="input-field text-xl font-bold"
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              autoFocus
            />
            <button
              onClick={handleSaveName}
              className="btn-primary text-sm"
              disabled={saving}
            >
              {saving ? "..." : "Guardar"}
            </button>
            <button
              onClick={() => { setEditingName(false); setEditName(groupName); }}
              className="btn-secondary text-sm"
            >
              Cancelar
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-3">
            <h2 className="text-xl font-bold">{groupName}</h2>
            <button
              onClick={() => setEditingName(true)}
              className="text-sm text-navy-400 hover:text-navy-600"
            >
              Editar
            </button>
          </div>
        )}
        <p className="mt-1 text-sm text-navy-400">Líder: {adminName}</p>
      </div>

      {/* Messages */}
      {error && (
        <div className="mb-4 rounded-xl bg-red-50 p-3 text-sm text-red-600">
          {error}
        </div>
      )}
      {success && (
        <div className="mb-4 rounded-xl bg-green-50 p-3 text-sm text-green-700">
          {success}
        </div>
      )}

      <div className="space-y-6">
        {/* Members section */}
        <div className="card space-y-4">
          <h3 className="text-sm font-bold uppercase tracking-wider text-navy-400">
            Miembros ({members.length})
          </h3>

          {members.length > 0 ? (
            <div className="space-y-2">
              {members.map((m) => (
                <div
                  key={m.id}
                  className="flex items-center justify-between rounded-xl border border-navy-100 p-3"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="font-semibold text-navy-700">{m.full_name}</p>
                      {!m.is_active && (
                        <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-600">
                          Inactivo
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-navy-400">{m.email}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="rounded-lg bg-navy-50 px-2 py-1 font-mono text-xs font-semibold text-navy-600">
                      {m.seller_code}
                    </span>
                    <button
                      onClick={() => handleRemoveMember(m.id)}
                      className="rounded-lg px-2 py-1 text-xs font-medium text-red-500 hover:bg-red-50"
                      title="Remover del grupo"
                    >
                      Remover
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="py-4 text-center text-sm text-navy-400">
              Sin miembros en este grupo
            </p>
          )}

          {/* Add member */}
          {availableSellers.length > 0 && (
            <div className="flex items-end gap-2 border-t border-navy-100 pt-4">
              <div className="flex-1">
                <label className="mb-1.5 block text-xs font-semibold text-navy-500">
                  Agregar vendedor
                </label>
                <select
                  className="input-field text-sm"
                  value={selectedSeller}
                  onChange={(e) => setSelectedSeller(e.target.value)}
                >
                  {availableSellers.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.full_name} ({s.seller_code})
                    </option>
                  ))}
                </select>
              </div>
              <button
                onClick={handleAddMember}
                className="btn-primary whitespace-nowrap text-sm"
                disabled={addingMember || !selectedSeller}
              >
                {addingMember ? "..." : "+ Agregar"}
              </button>
            </div>
          )}
        </div>

        {/* Campaigns section */}
        <div className="card space-y-4">
          <h3 className="text-sm font-bold uppercase tracking-wider text-navy-400">
            Campañas asignadas ({assignedCampaigns.length})
          </h3>

          {assignedCampaigns.length > 0 ? (
            <div className="space-y-2">
              {assignedCampaigns.map((c) => (
                <div
                  key={c.id}
                  className="flex items-center justify-between rounded-xl border border-navy-100 p-3"
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="font-semibold text-navy-700">{c.name}</p>
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                          c.status === "active"
                            ? "bg-green-100 text-green-700"
                            : c.status === "sorted"
                              ? "bg-purple-100 text-purple-700"
                              : c.status === "draft"
                                ? "bg-yellow-100 text-yellow-700"
                                : "bg-gray-100 text-gray-700"
                        }`}
                      >
                        {c.status === "active"
                          ? "Activa"
                          : c.status === "sorted"
                            ? "Sorteada"
                            : c.status === "draft"
                              ? "Borrador"
                              : "Cerrada"}
                      </span>
                    </div>
                    <p className="text-xs text-navy-400">/{c.slug}</p>
                  </div>
                  <button
                    onClick={() => handleRemoveCampaign(c.id)}
                    className="rounded-lg px-2 py-1 text-xs font-medium text-red-500 hover:bg-red-50"
                    title="Remover campaña del grupo"
                  >
                    Remover
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <p className="py-4 text-center text-sm text-navy-400">
              Sin campañas asignadas
            </p>
          )}

          {/* Add campaign */}
          {unassignedCampaigns.length > 0 && (
            <div className="flex items-end gap-2 border-t border-navy-100 pt-4">
              <div className="flex-1">
                <label className="mb-1.5 block text-xs font-semibold text-navy-500">
                  Asignar campaña
                </label>
                <select
                  className="input-field text-sm"
                  value={selectedCampaign}
                  onChange={(e) => setSelectedCampaign(e.target.value)}
                >
                  {unassignedCampaigns.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} ({c.status === "active" ? "Activa" : c.status === "draft" ? "Borrador" : c.status})
                    </option>
                  ))}
                </select>
              </div>
              <button
                onClick={handleAddCampaign}
                className="btn-primary whitespace-nowrap text-sm"
                disabled={addingCampaign || !selectedCampaign}
              >
                {addingCampaign ? "..." : "+ Asignar"}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
