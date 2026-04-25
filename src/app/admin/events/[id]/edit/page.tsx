"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import type { Event, EventTicketType } from "@/types/database";
import { formatCurrency } from "@/lib/format";

interface EventSellerRow {
  id: string;
  event_id: string;
  seller_id: string;
  can_sell: boolean;
  can_scan: boolean;
  profiles: {
    id: string;
    full_name: string;
    email: string;
    seller_code: string | null;
  } | null;
}

interface EventResponse {
  event: Event;
  ticket_types: EventTicketType[];
  sellers: EventSellerRow[];
}

type Tab = "info" | "types" | "sellers";

const COLOR_OPTIONS = [
  { value: "gray", label: "Gris", class: "bg-gray-200 text-gray-700" },
  { value: "gold", label: "Dorado", class: "bg-gold-400 text-navy-800" },
  { value: "green", label: "Verde", class: "bg-green-200 text-green-800" },
  { value: "blue", label: "Azul", class: "bg-blue-200 text-blue-800" },
  { value: "purple", label: "Púrpura", class: "bg-purple-200 text-purple-800" },
  { value: "rose", label: "Rosa", class: "bg-rose-200 text-rose-800" },
];

export default function EditEventPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const eventId = params.id;

  const [tab, setTab] = useState<Tab>("info");
  const [data, setData] = useState<EventResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/events/${eventId}`);
      const json = await res.json();
      if (!res.ok) {
        setError(json.error || "Error al cargar evento");
        setLoading(false);
        return;
      }
      setData(json);
    } catch {
      setError("Error de red");
    }
    setLoading(false);
  }, [eventId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  if (loading)
    return (
      <div className="flex items-center justify-center py-20">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-gold-200 border-t-gold-500" />
      </div>
    );

  if (error || !data)
    return (
      <div className="py-12 text-center">
        <p className="text-sm text-red-600">{error || "Evento no encontrado"}</p>
        <Link href="/admin/events" className="btn-secondary mt-4 inline-block">
          Volver
        </Link>
      </div>
    );

  return (
    <div>
      <Link
        href="/admin/events"
        className="mb-3 inline-flex items-center gap-1 text-sm text-navy-400 hover:text-navy-700"
      >
        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
        </svg>
        Volver
      </Link>

      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold">{data.event.name}</h2>
          <p className="text-sm text-navy-400">/{data.event.slug}</p>
        </div>
        <span
          className={`rounded-full px-3 py-1 text-xs font-medium ${
            data.event.status === "active"
              ? "bg-green-100 text-green-700"
              : data.event.status === "past"
                ? "bg-gray-100 text-gray-600"
                : data.event.status === "cancelled"
                  ? "bg-red-100 text-red-700"
                  : "bg-yellow-100 text-yellow-700"
          }`}
        >
          {data.event.status === "draft"
            ? "Borrador"
            : data.event.status === "active"
              ? "Activo"
              : data.event.status === "past"
                ? "Pasado"
                : "Cancelado"}
        </span>
      </div>

      {/* Tabs */}
      <div className="mb-4 flex flex-wrap gap-2">
        {(
          [
            { key: "info", label: "Información" },
            { key: "types", label: `Tipos (${data.ticket_types.length})` },
            { key: "sellers", label: `Vendedores (${data.sellers.length})` },
          ] as const
        ).map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
              tab === t.key
                ? "bg-navy-700 text-white"
                : "border border-navy-200 text-navy-600 hover:bg-navy-50"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "info" && (
        <InfoTab
          event={data.event}
          onUpdate={fetchData}
          onDelete={() => router.push("/admin/events")}
        />
      )}
      {tab === "types" && (
        <TypesTab
          eventId={eventId}
          types={data.ticket_types}
          onChange={fetchData}
        />
      )}
      {tab === "sellers" && (
        <SellersTab
          eventId={eventId}
          sellers={data.sellers}
          onChange={fetchData}
        />
      )}
    </div>
  );
}

// ────────────────────────────────────────────────────────────
// Info tab
// ────────────────────────────────────────────────────────────
function InfoTab({
  event,
  onUpdate,
  onDelete,
}: {
  event: Event;
  onUpdate: () => void;
  onDelete: () => void;
}) {
  const [name, setName] = useState(event.name);
  const [slug, setSlug] = useState(event.slug);
  const [description, setDescription] = useState(event.description || "");
  const [eventDate, setEventDate] = useState(
    new Date(event.event_date).toISOString().slice(0, 16),
  );
  const [venue, setVenue] = useState(event.venue || "");
  const [status, setStatus] = useState(event.status);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [ok, setOk] = useState(false);

  async function save() {
    setSaving(true);
    setErr(null);
    setOk(false);
    try {
      const res = await fetch(`/api/events/${event.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          slug,
          description: description || null,
          event_date: new Date(eventDate).toISOString(),
          venue: venue || null,
          status,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        setErr(json.error || "Error al guardar");
      } else {
        setOk(true);
        onUpdate();
        setTimeout(() => setOk(false), 2000);
      }
    } catch {
      setErr("Error de red");
    }
    setSaving(false);
  }

  async function remove() {
    if (!confirm("¿Eliminar este evento? No se puede deshacer.")) return;
    try {
      const res = await fetch(`/api/events/${event.id}`, { method: "DELETE" });
      const json = await res.json();
      if (!res.ok) {
        setErr(json.error || "Error al eliminar");
      } else {
        onDelete();
      }
    } catch {
      setErr("Error de red");
    }
  }

  return (
    <div className="card space-y-4">
      <div>
        <label className="mb-1.5 block text-sm font-semibold text-navy-700">Nombre</label>
        <input
          type="text"
          className="input-field"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
      </div>

      <div>
        <label className="mb-1.5 block text-sm font-semibold text-navy-700">Slug</label>
        <input
          type="text"
          className="input-field font-mono"
          value={slug}
          onChange={(e) => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]+/g, "-"))}
        />
      </div>

      <div>
        <label className="mb-1.5 block text-sm font-semibold text-navy-700">Descripción</label>
        <textarea
          className="input-field min-h-[80px]"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />
      </div>

      <div>
        <label className="mb-1.5 block text-sm font-semibold text-navy-700">Fecha y hora</label>
        <input
          type="datetime-local"
          className="input-field"
          value={eventDate}
          onChange={(e) => setEventDate(e.target.value)}
        />
      </div>

      <div>
        <label className="mb-1.5 block text-sm font-semibold text-navy-700">Lugar</label>
        <input
          type="text"
          className="input-field"
          value={venue}
          onChange={(e) => setVenue(e.target.value)}
        />
      </div>

      <div>
        <label className="mb-1.5 block text-sm font-semibold text-navy-700">Estado</label>
        <select
          className="input-field"
          value={status}
          onChange={(e) => setStatus(e.target.value as Event["status"])}
        >
          <option value="draft">Borrador</option>
          <option value="active">Activo</option>
          <option value="past">Pasado</option>
          <option value="cancelled">Cancelado</option>
        </select>
      </div>

      {err && <div className="rounded-xl bg-red-50 p-3 text-sm text-red-600">{err}</div>}
      {ok && (
        <div className="rounded-xl bg-green-50 p-3 text-sm text-green-700">
          Cambios guardados.
        </div>
      )}

      <div className="flex gap-2">
        <button className="btn-gold flex-1" onClick={save} disabled={saving}>
          {saving ? "Guardando..." : "Guardar"}
        </button>
        <button
          className="rounded-xl border border-red-200 px-4 py-2 text-sm font-medium text-red-600 transition hover:bg-red-50"
          onClick={remove}
        >
          Eliminar
        </button>
      </div>
    </div>
  );
}

// ────────────────────────────────────────────────────────────
// Types tab
// ────────────────────────────────────────────────────────────
function TypesTab({
  eventId,
  types,
  onChange,
}: {
  eventId: string;
  types: EventTicketType[];
  onChange: () => void;
}) {
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  return (
    <div className="space-y-3">
      {!showForm && (
        <button onClick={() => setShowForm(true)} className="btn-gold w-full">
          + Agregar tipo de entrada
        </button>
      )}

      {showForm && (
        <TicketTypeForm
          eventId={eventId}
          initial={null}
          onDone={() => {
            setShowForm(false);
            onChange();
          }}
          onCancel={() => setShowForm(false)}
        />
      )}

      {types.length === 0 ? (
        <p className="py-8 text-center text-sm text-navy-400">
          Aún no hay tipos. Creá el primero (ej: General, VIP).
        </p>
      ) : (
        types.map((t) => {
          const isEditing = editingId === t.id;
          const color =
            COLOR_OPTIONS.find((c) => c.value === t.color) || COLOR_OPTIONS[0];

          return isEditing ? (
            <TicketTypeForm
              key={t.id}
              eventId={eventId}
              initial={t}
              onDone={() => {
                setEditingId(null);
                onChange();
              }}
              onCancel={() => setEditingId(null)}
            />
          ) : (
            <div key={t.id} className="card">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-semibold ${color.class}`}
                    >
                      {t.name}
                    </span>
                    {t.is_complimentary && (
                      <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700">
                        Cortesía
                      </span>
                    )}
                  </div>
                  {t.description && (
                    <p className="mt-1 text-xs text-navy-400">{t.description}</p>
                  )}
                  <div className="mt-2 flex flex-wrap gap-3 text-sm">
                    <span className="font-bold text-navy-700">
                      {formatCurrency(t.price)}
                    </span>
                    <span className="text-navy-400">
                      Cupo:{" "}
                      <strong>
                        {t.quantity === null ? "Sin límite" : t.quantity}
                      </strong>
                    </span>
                  </div>
                </div>
                <button
                  onClick={() => setEditingId(t.id)}
                  className="text-xs font-medium text-navy-400 hover:text-navy-700"
                >
                  Editar
                </button>
              </div>
            </div>
          );
        })
      )}
    </div>
  );
}

function TicketTypeForm({
  eventId,
  initial,
  onDone,
  onCancel,
}: {
  eventId: string;
  initial: EventTicketType | null;
  onDone: () => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState(initial?.name || "");
  const [description, setDescription] = useState(initial?.description || "");
  const [price, setPrice] = useState(String(initial?.price ?? "1000"));
  const [unlimited, setUnlimited] = useState(initial?.quantity === null);
  const [quantity, setQuantity] = useState(
    initial?.quantity != null ? String(initial.quantity) : "100",
  );
  const [color, setColor] = useState(initial?.color || "gray");
  const [isComplimentary, setIsComplimentary] = useState(
    initial?.is_complimentary ?? false,
  );
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function submit() {
    setSaving(true);
    setErr(null);
    try {
      const body = {
        name,
        description: description || null,
        price: Number(price),
        quantity: unlimited ? null : Number(quantity),
        color,
        is_complimentary: isComplimentary,
      };
      const url = initial
        ? `/api/events/${eventId}/ticket-types/${initial.id}`
        : `/api/events/${eventId}/ticket-types`;
      const res = await fetch(url, {
        method: initial ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (!res.ok) {
        setErr(json.error || "Error al guardar");
      } else {
        onDone();
      }
    } catch {
      setErr("Error de red");
    }
    setSaving(false);
  }

  async function remove() {
    if (!initial) return;
    if (!confirm("¿Eliminar este tipo de entrada?")) return;
    try {
      const res = await fetch(
        `/api/events/${eventId}/ticket-types/${initial.id}`,
        { method: "DELETE" },
      );
      const json = await res.json();
      if (!res.ok) {
        setErr(json.error || "Error al eliminar");
      } else {
        onDone();
      }
    } catch {
      setErr("Error de red");
    }
  }

  return (
    <div className="card space-y-3 border-gold-200 bg-gold-50/30">
      <div>
        <label className="mb-1 block text-xs font-semibold text-navy-700">Nombre *</label>
        <input
          type="text"
          className="input-field"
          placeholder="Ej: General, VIP, Early Bird"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
      </div>
      <div>
        <label className="mb-1 block text-xs font-semibold text-navy-700">Descripción</label>
        <input
          type="text"
          className="input-field"
          placeholder="Opcional"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="mb-1 block text-xs font-semibold text-navy-700">Precio *</label>
          <input
            type="number"
            min="0"
            className="input-field"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-semibold text-navy-700">
            Cupo {unlimited ? "" : "*"}
          </label>
          <input
            type="number"
            min="1"
            className="input-field disabled:bg-gray-50 disabled:text-gray-400"
            value={unlimited ? "" : quantity}
            onChange={(e) => setQuantity(e.target.value)}
            disabled={unlimited}
            placeholder={unlimited ? "Sin límite" : ""}
          />
        </div>
      </div>

      <label className="flex cursor-pointer items-center gap-2">
        <input
          type="checkbox"
          checked={unlimited}
          onChange={(e) => setUnlimited(e.target.checked)}
          className="h-4 w-4 accent-gold-500"
        />
        <span className="text-sm text-navy-700">Sin cupo (cantidad ilimitada)</span>
      </label>
      <div>
        <label className="mb-1 block text-xs font-semibold text-navy-700">Color</label>
        <div className="flex flex-wrap gap-2">
          {COLOR_OPTIONS.map((c) => (
            <button
              key={c.value}
              type="button"
              onClick={() => setColor(c.value)}
              className={`rounded-full px-3 py-1 text-xs font-semibold transition-all ${c.class} ${
                color === c.value ? "ring-2 ring-navy-700 ring-offset-1" : ""
              }`}
            >
              {c.label}
            </button>
          ))}
        </div>
      </div>
      <label className="flex cursor-pointer items-center gap-2">
        <input
          type="checkbox"
          checked={isComplimentary}
          onChange={(e) => setIsComplimentary(e.target.checked)}
          className="h-4 w-4 accent-gold-500"
        />
        <span className="text-sm text-navy-700">Cortesía (solo admin emite, sin pago)</span>
      </label>

      {err && <div className="rounded-xl bg-red-50 p-2 text-xs text-red-600">{err}</div>}

      <div className="flex gap-2">
        <button className="btn-gold flex-1 text-sm" onClick={submit} disabled={saving}>
          {saving ? "Guardando..." : initial ? "Guardar" : "Crear"}
        </button>
        {initial && (
          <button
            className="rounded-xl border border-red-200 px-3 py-2 text-sm font-medium text-red-600 transition hover:bg-red-50"
            onClick={remove}
          >
            Eliminar
          </button>
        )}
        <button className="btn-secondary text-sm" onClick={onCancel}>
          Cancelar
        </button>
      </div>
    </div>
  );
}

// ────────────────────────────────────────────────────────────
// Sellers tab
// ────────────────────────────────────────────────────────────
function SellersTab({
  eventId,
  sellers,
  onChange,
}: {
  eventId: string;
  sellers: EventSellerRow[];
  onChange: () => void;
}) {
  const [availableSellers, setAvailableSellers] = useState<
    { id: string; full_name: string; email: string; seller_code: string | null }[]
  >([]);
  const [showForm, setShowForm] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const { createClient } = await import("@/lib/supabase/client");
      const supabase = createClient();
      const { data } = await supabase
        .from("profiles")
        .select("id, full_name, email, seller_code")
        .eq("is_active", true)
        .order("full_name", { ascending: true });
      setAvailableSellers(data || []);
    })();
  }, []);

  const assignedIds = new Set(sellers.map((s) => s.seller_id));
  const unassigned = availableSellers.filter((s) => !assignedIds.has(s.id));

  async function toggleFlag(
    sellerId: string,
    field: "can_sell" | "can_scan",
    value: boolean,
  ) {
    try {
      const res = await fetch(`/api/events/${eventId}/sellers`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          seller_id: sellerId,
          can_sell:
            field === "can_sell" ? value : sellers.find((s) => s.seller_id === sellerId)!.can_sell,
          can_scan:
            field === "can_scan" ? value : sellers.find((s) => s.seller_id === sellerId)!.can_scan,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        setErr(json.error || "Error al actualizar");
        return;
      }
      onChange();
    } catch {
      setErr("Error de red");
    }
  }

  async function unassign(sellerId: string) {
    if (!confirm("¿Desasignar este vendedor?")) return;
    try {
      const res = await fetch(
        `/api/events/${eventId}/sellers?seller_id=${sellerId}`,
        { method: "DELETE" },
      );
      const json = await res.json();
      if (!res.ok) {
        setErr(json.error || "Error al desasignar");
        return;
      }
      onChange();
    } catch {
      setErr("Error de red");
    }
  }

  async function assign(sellerId: string, canSell: boolean, canScan: boolean) {
    try {
      const res = await fetch(`/api/events/${eventId}/sellers`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          seller_id: sellerId,
          can_sell: canSell,
          can_scan: canScan,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        setErr(json.error || "Error al asignar");
        return;
      }
      setShowForm(false);
      onChange();
    } catch {
      setErr("Error de red");
    }
  }

  return (
    <div className="space-y-3">
      {!showForm && (
        <button
          onClick={() => setShowForm(true)}
          className="btn-gold w-full"
          disabled={unassigned.length === 0}
        >
          + Asignar vendedor
        </button>
      )}

      {showForm && (
        <AssignSellerForm
          candidates={unassigned}
          onCancel={() => setShowForm(false)}
          onAssign={assign}
        />
      )}

      {err && (
        <div className="rounded-xl bg-red-50 p-2 text-xs text-red-600">{err}</div>
      )}

      {sellers.length === 0 ? (
        <p className="py-8 text-center text-sm text-navy-400">
          Sin vendedores asignados. Asigná alguno para que pueda vender o escanear.
        </p>
      ) : (
        sellers.map((s) => (
          <div key={s.id} className="card">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <p className="font-semibold text-navy-700">
                  {s.profiles?.full_name || "—"}
                </p>
                <p className="text-xs text-navy-400">
                  {s.profiles?.seller_code && (
                    <span className="mr-2 font-mono">{s.profiles.seller_code}</span>
                  )}
                  {s.profiles?.email}
                </p>
                <div className="mt-2 flex gap-3">
                  <label className="flex cursor-pointer items-center gap-1 text-xs">
                    <input
                      type="checkbox"
                      checked={s.can_sell}
                      onChange={(e) =>
                        toggleFlag(s.seller_id, "can_sell", e.target.checked)
                      }
                      className="h-3.5 w-3.5 accent-gold-500"
                    />
                    <span className="font-medium text-navy-700">Puede vender</span>
                  </label>
                  <label className="flex cursor-pointer items-center gap-1 text-xs">
                    <input
                      type="checkbox"
                      checked={s.can_scan}
                      onChange={(e) =>
                        toggleFlag(s.seller_id, "can_scan", e.target.checked)
                      }
                      className="h-3.5 w-3.5 accent-gold-500"
                    />
                    <span className="font-medium text-navy-700">Puede escanear</span>
                  </label>
                </div>
              </div>
              <button
                onClick={() => unassign(s.seller_id)}
                className="text-xs font-medium text-red-500 hover:text-red-700"
              >
                Quitar
              </button>
            </div>
          </div>
        ))
      )}
    </div>
  );
}

function AssignSellerForm({
  candidates,
  onAssign,
  onCancel,
}: {
  candidates: { id: string; full_name: string; email: string; seller_code: string | null }[];
  onAssign: (sellerId: string, canSell: boolean, canScan: boolean) => void;
  onCancel: () => void;
}) {
  const [sellerId, setSellerId] = useState("");
  const [canSell, setCanSell] = useState(true);
  const [canScan, setCanScan] = useState(false);
  const [search, setSearch] = useState("");

  const filtered = search
    ? candidates.filter(
        (c) =>
          c.full_name.toLowerCase().includes(search.toLowerCase()) ||
          c.email.toLowerCase().includes(search.toLowerCase()) ||
          (c.seller_code && c.seller_code.toLowerCase().includes(search.toLowerCase())),
      )
    : candidates;

  return (
    <div className="card space-y-3 border-gold-200 bg-gold-50/30">
      <input
        type="text"
        className="input-field"
        placeholder="Buscar vendedor..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />

      <div className="max-h-64 overflow-y-auto rounded-xl border border-navy-100 bg-white">
        {filtered.length === 0 ? (
          <p className="p-4 text-center text-sm text-navy-400">Sin resultados</p>
        ) : (
          filtered.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => setSellerId(c.id)}
              className={`flex w-full items-center gap-3 border-b border-navy-50 px-3 py-2 text-left transition-colors last:border-b-0 ${
                sellerId === c.id ? "bg-gold-100" : "hover:bg-navy-50"
              }`}
            >
              <div className="flex-1">
                <p className="text-sm font-medium text-navy-700">{c.full_name}</p>
                <p className="text-xs text-navy-400">{c.email}</p>
              </div>
              {c.seller_code && (
                <span className="rounded bg-navy-50 px-2 py-0.5 font-mono text-xs text-navy-600">
                  {c.seller_code}
                </span>
              )}
            </button>
          ))
        )}
      </div>

      <div className="flex gap-3">
        <label className="flex cursor-pointer items-center gap-1.5 text-sm">
          <input
            type="checkbox"
            checked={canSell}
            onChange={(e) => setCanSell(e.target.checked)}
            className="h-4 w-4 accent-gold-500"
          />
          <span className="font-medium text-navy-700">Puede vender</span>
        </label>
        <label className="flex cursor-pointer items-center gap-1.5 text-sm">
          <input
            type="checkbox"
            checked={canScan}
            onChange={(e) => setCanScan(e.target.checked)}
            className="h-4 w-4 accent-gold-500"
          />
          <span className="font-medium text-navy-700">Puede escanear</span>
        </label>
      </div>

      <div className="flex gap-2">
        <button
          className="btn-gold flex-1 text-sm"
          disabled={!sellerId}
          onClick={() => onAssign(sellerId, canSell, canScan)}
        >
          Asignar
        </button>
        <button className="btn-secondary text-sm" onClick={onCancel}>
          Cancelar
        </button>
      </div>
    </div>
  );
}
