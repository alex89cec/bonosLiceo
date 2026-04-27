"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import type { Profile } from "@/types/database";
import { getGroupColor } from "@/lib/group-colors";

export type ProfileWithGroup = Profile & {
  seller_group: { id: string; name: string; color: string } | null;
};

interface SellersListProps {
  profiles: ProfileWithGroup[];
}

const FILTERS = [
  { key: "todos", label: "Todos" },
  { key: "activos", label: "Activos" },
  { key: "vendedores", label: "Vendedores" },
  { key: "admins", label: "Admins" },
  { key: "inactivos", label: "Inactivos" },
] as const;

type FilterKey = (typeof FILTERS)[number]["key"];

export default function SellersList({ profiles }: SellersListProps) {
  const [search, setSearch] = useState("");
  const [activeFilter, setActiveFilter] = useState<FilterKey>("todos");

  // Counts for each filter pill (always based on full list, not filtered)
  const counts = useMemo(
    () => ({
      todos: profiles.length,
      activos: profiles.filter((p) => p.is_active).length,
      vendedores: profiles.filter((p) => p.role === "seller").length,
      admins: profiles.filter((p) => p.role === "admin").length,
      inactivos: profiles.filter((p) => !p.is_active).length,
    }),
    [profiles],
  );

  // Filtered list
  const filtered = useMemo(() => {
    let result = profiles;

    // 1. Category filter
    switch (activeFilter) {
      case "activos":
        result = result.filter((p) => p.is_active);
        break;
      case "vendedores":
        result = result.filter((p) => p.role === "seller");
        break;
      case "admins":
        result = result.filter((p) => p.role === "admin");
        break;
      case "inactivos":
        result = result.filter((p) => !p.is_active);
        break;
    }

    // 2. Search across name, email, seller_code
    if (search.trim()) {
      const q = search.toLowerCase().trim();
      result = result.filter(
        (p) =>
          p.full_name.toLowerCase().includes(q) ||
          p.email.toLowerCase().includes(q) ||
          (p.seller_code && p.seller_code.toLowerCase().includes(q)),
      );
    }

    return result;
  }, [profiles, activeFilter, search]);

  return (
    <div className="space-y-4">
      {/* Search bar */}
      <div className="relative">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-navy-400"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
          />
        </svg>
        <input
          type="text"
          className="input-field pl-10"
          placeholder="Buscar por nombre, email o codigo..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {/* Filter pills */}
      <div className="flex flex-wrap gap-2">
        {FILTERS.map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setActiveFilter(key)}
            className={`rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
              activeFilter === key
                ? "bg-navy-700 text-white"
                : "border border-navy-200 text-navy-600 hover:bg-navy-50"
            }`}
          >
            {label}
            <span className="ml-1.5 text-xs opacity-70">{counts[key]}</span>
          </button>
        ))}
      </div>

      {/* Results count */}
      <p className="text-sm text-gray-400">
        Mostrando {filtered.length} de {profiles.length}
      </p>

      {/* User cards */}
      {filtered.length > 0 ? (
        <div className="space-y-3">
          {filtered.map((profile) => (
            <Link
              key={profile.id}
              href={`/admin/sellers/${profile.id}`}
              className="card block transition-all hover:border-gold-400 hover:bg-gold-50"
            >
              <div className="flex items-center justify-between">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold">{profile.full_name}</h3>
                    {profile.role === "admin" && (
                      <span className="rounded-full bg-gold-500 px-2 py-0.5 text-xs font-bold text-white">
                        Admin
                      </span>
                    )}
                    {!profile.is_active && (
                      <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-600">
                        Inactivo
                      </span>
                    )}
                    {profile.is_approver && (
                      <span className="rounded-full bg-purple-100 px-2 py-0.5 text-xs font-medium text-purple-700">
                        Validador
                      </span>
                    )}
                    {profile.seller_group && (() => {
                      const gc = getGroupColor(profile.seller_group.color);
                      return (
                        <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${gc.bg} ${gc.text}`}>
                          {profile.seller_group.name}
                        </span>
                      );
                    })()}
                    {profile.must_change_password && (
                      <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-600">
                        Pendiente
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-gray-500">{profile.email}</p>
                </div>
                <div className="flex items-center gap-3">
                  <span
                    className={`rounded-lg px-3 py-1 font-mono text-sm ${
                      profile.role === "admin"
                        ? "bg-gold-400 font-bold text-navy-800"
                        : "bg-gray-100 font-semibold text-gray-600"
                    }`}
                  >
                    {profile.seller_code || "—"}
                  </span>
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
              <div className="mt-2 flex flex-wrap gap-4 text-xs text-gray-400">
                <span>
                  Creado:{" "}
                  {new Date(profile.created_at).toLocaleDateString("es")}
                </span>
                {profile.phone && <span>Tel: {profile.phone}</span>}
              </div>
            </Link>
          ))}
        </div>
      ) : (
        <p className="py-12 text-center text-gray-500">
          No se encontraron resultados.
        </p>
      )}
    </div>
  );
}
