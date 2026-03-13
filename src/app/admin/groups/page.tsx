"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { GROUP_COLORS, getGroupColor } from "@/lib/group-colors";

interface GroupEntry {
  id: string;
  name: string;
  color: string;
  is_active: boolean;
  admin: { full_name: string; email: string } | null;
  member_count: number;
  campaign_count: number;
  created_at: string;
}

export default function AdminGroupsPage() {
  const [groups, setGroups] = useState<GroupEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // New group form
  const [showForm, setShowForm] = useState(false);
  const [newName, setNewName] = useState("");
  const [admins, setAdmins] = useState<{ id: string; full_name: string }[]>([]);
  const [selectedAdmin, setSelectedAdmin] = useState("");
  const [selectedColor, setSelectedColor] = useState("blue");
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  useEffect(() => {
    fetchGroups();
  }, []);

  async function fetchGroups() {
    try {
      const res = await fetch("/api/groups");
      const data = await res.json();
      if (res.ok) {
        setGroups(data.groups || []);
        const adminList = data.admins || [];
        setAdmins(adminList);
        if (adminList.length > 0 && !selectedAdmin) {
          setSelectedAdmin(adminList[0].id);
        }
      } else {
        setError(data.error || "Error al cargar grupos");
      }
    } catch {
      setError("Error de conexión");
    }
    setLoading(false);
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setCreating(true);
    setCreateError(null);

    try {
      const res = await fetch("/api/groups", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newName.trim(), admin_id: selectedAdmin, color: selectedColor }),
      });
      const data = await res.json();
      if (res.ok) {
        setNewName("");
        setSelectedColor("blue");
        setShowForm(false);
        fetchGroups();
      } else {
        setCreateError(data.error || "Error al crear grupo");
      }
    } catch {
      setCreateError("Error de conexión");
    }
    setCreating(false);
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-gold-200 border-t-gold-500" />
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h2 className="text-xl font-bold">Grupos</h2>
        <button
          onClick={() => setShowForm(!showForm)}
          className="btn-primary"
        >
          {showForm ? "Cancelar" : "+ Nuevo grupo"}
        </button>
      </div>

      {/* Create form */}
      {showForm && (
        <form onSubmit={handleCreate} className="card mb-6 space-y-4">
          <h3 className="text-sm font-bold uppercase tracking-wider text-navy-400">
            Crear grupo
          </h3>
          <div>
            <label
              htmlFor="groupName"
              className="mb-1.5 block text-sm font-semibold text-navy-700"
            >
              Nombre del grupo
            </label>
            <input
              id="groupName"
              type="text"
              className="input-field"
              placeholder="ej: Equipo A"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              required
              maxLength={200}
            />
          </div>
          <div>
            <label
              htmlFor="groupAdmin"
              className="mb-1.5 block text-sm font-semibold text-navy-700"
            >
              Líder del grupo
            </label>
            <select
              id="groupAdmin"
              className="input-field"
              value={selectedAdmin}
              onChange={(e) => setSelectedAdmin(e.target.value)}
              required
            >
              {admins.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.full_name}
                </option>
              ))}
            </select>
          </div>
          {/* Color picker */}
          <div>
            <label className="mb-1.5 block text-sm font-semibold text-navy-700">
              Color del grupo
            </label>
            <div className="flex flex-wrap gap-3">
              {GROUP_COLORS.map((c) => (
                <button
                  key={c.key}
                  type="button"
                  onClick={() => setSelectedColor(c.key)}
                  className={`h-8 w-8 rounded-full transition-all ${c.dot} ${
                    selectedColor === c.key
                      ? "ring-2 ring-navy-700 ring-offset-2"
                      : "hover:scale-110"
                  }`}
                  title={c.key}
                />
              ))}
            </div>
          </div>
          {createError && (
            <p className="text-sm text-red-600">{createError}</p>
          )}
          <button
            type="submit"
            className="btn-gold w-full"
            disabled={creating || !newName.trim() || !selectedAdmin}
          >
            {creating ? "Creando..." : "Crear grupo"}
          </button>
        </form>
      )}

      {error && (
        <div className="mb-4 rounded-xl bg-red-50 p-3 text-sm text-red-600">
          {error}
        </div>
      )}

      {/* Groups list */}
      {groups.length > 0 ? (
        <div className="space-y-3">
          {groups.map((g) => (
            <Link
              key={g.id}
              href={`/admin/groups/${g.id}`}
              className="card block transition-all hover:border-gold-400 hover:bg-gold-50"
            >
              <div className="flex items-center justify-between">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className={`inline-block h-3 w-3 rounded-full ${getGroupColor(g.color).dot}`} />
                    <h3 className="font-semibold">{g.name}</h3>
                    {!g.is_active && (
                      <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-600">
                        Inactivo
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-gray-500">
                    Líder: {g.admin?.full_name || "—"}
                  </p>
                </div>
                <div className="flex items-center gap-4">
                  <div className="text-right">
                    <p className="text-sm font-bold text-navy-700">
                      {g.member_count}
                    </p>
                    <p className="text-xs text-navy-400">miembros</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-bold text-navy-700">
                      {g.campaign_count}
                    </p>
                    <p className="text-xs text-navy-400">campañas</p>
                  </div>
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className="h-4 w-4 text-gray-400"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M9 5l7 7-7 7"
                    />
                  </svg>
                </div>
              </div>
            </Link>
          ))}
        </div>
      ) : (
        <p className="py-12 text-center text-gray-500">
          No hay grupos. Crea el primero.
        </p>
      )}
    </div>
  );
}
