"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export default function NewEventPage() {
  const router = useRouter();

  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [slugManual, setSlugManual] = useState(false);
  const [description, setDescription] = useState("");
  const [eventDate, setEventDate] = useState("");
  const [venue, setVenue] = useState("");
  const [status, setStatus] = useState<"draft" | "active">("draft");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function handleNameChange(value: string) {
    setName(value);
    if (!slugManual) {
      setSlug(slugify(value));
    }
  }

  function handleSlugChange(value: string) {
    setSlugManual(true);
    setSlug(slugify(value));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      // Convert datetime-local input to ISO string
      const isoDate = eventDate ? new Date(eventDate).toISOString() : "";

      const res = await fetch("/api/events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          slug,
          description: description || null,
          event_date: isoDate,
          venue: venue || null,
          status,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Error al crear el evento");
        setLoading(false);
        return;
      }

      router.push(`/admin/events/${data.event.id}/edit`);
    } catch {
      setError("Error de red. Intentá de nuevo.");
      setLoading(false);
    }
  }

  return (
    <div>
      <Link
        href="/admin/events"
        className="mb-4 inline-flex items-center gap-1 text-sm text-navy-400 hover:text-navy-700"
      >
        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
        </svg>
        Volver
      </Link>

      <h2 className="mb-4 text-xl font-bold">Nuevo evento</h2>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="name" className="mb-1.5 block text-sm font-semibold text-navy-700">
            Nombre *
          </label>
          <input
            id="name"
            type="text"
            className="input-field"
            placeholder="Ej: Festival de Primavera 2026"
            value={name}
            onChange={(e) => handleNameChange(e.target.value)}
            required
          />
        </div>

        <div>
          <label htmlFor="slug" className="mb-1.5 block text-sm font-semibold text-navy-700">
            Slug (URL) *
          </label>
          <input
            id="slug"
            type="text"
            className="input-field font-mono"
            placeholder="festival-primavera-2026"
            value={slug}
            onChange={(e) => handleSlugChange(e.target.value)}
            required
          />
          <p className="mt-1 text-xs text-navy-400">
            Se usará en la URL: /tickets/{slug || "slug"}
          </p>
        </div>

        <div>
          <label htmlFor="description" className="mb-1.5 block text-sm font-semibold text-navy-700">
            Descripción
          </label>
          <textarea
            id="description"
            className="input-field min-h-[80px]"
            placeholder="Descripción del evento..."
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </div>

        <div>
          <label htmlFor="eventDate" className="mb-1.5 block text-sm font-semibold text-navy-700">
            Fecha y hora *
          </label>
          <input
            id="eventDate"
            type="datetime-local"
            className="input-field"
            value={eventDate}
            onChange={(e) => setEventDate(e.target.value)}
            required
          />
        </div>

        <div>
          <label htmlFor="venue" className="mb-1.5 block text-sm font-semibold text-navy-700">
            Lugar
          </label>
          <input
            id="venue"
            type="text"
            className="input-field"
            placeholder="Ej: Liceo Militar - Predio principal"
            value={venue}
            onChange={(e) => setVenue(e.target.value)}
          />
        </div>

        <div>
          <label className="mb-1.5 block text-sm font-semibold text-navy-700">
            Estado inicial
          </label>
          <div className="grid grid-cols-2 gap-2">
            <label className="flex cursor-pointer items-center gap-2 rounded-xl border-2 border-navy-200 p-3 transition-all has-[:checked]:border-gold-500 has-[:checked]:bg-gold-50">
              <input
                type="radio"
                name="status"
                value="draft"
                checked={status === "draft"}
                onChange={() => setStatus("draft")}
                className="h-4 w-4 accent-gold-500"
              />
              <span className="text-sm font-medium text-navy-700">Borrador</span>
            </label>
            <label className="flex cursor-pointer items-center gap-2 rounded-xl border-2 border-navy-200 p-3 transition-all has-[:checked]:border-gold-500 has-[:checked]:bg-gold-50">
              <input
                type="radio"
                name="status"
                value="active"
                checked={status === "active"}
                onChange={() => setStatus("active")}
                className="h-4 w-4 accent-gold-500"
              />
              <span className="text-sm font-medium text-navy-700">Activo</span>
            </label>
          </div>
          <p className="mt-1 text-xs text-navy-400">
            Podés crear tipos de entrada y asignar vendedores después de guardar.
          </p>
        </div>

        {error && (
          <div className="rounded-xl bg-red-50 p-3 text-sm text-red-600">{error}</div>
        )}

        <button
          type="submit"
          disabled={loading || !name || !slug || !eventDate}
          className="btn-gold w-full"
        >
          {loading ? "Creando..." : "Crear evento"}
        </button>
      </form>
    </div>
  );
}
