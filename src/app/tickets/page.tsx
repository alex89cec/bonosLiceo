import Link from "next/link";
import { createServiceRoleClient } from "@/lib/supabase/server";
import type { Event } from "@/types/database";

export const dynamic = "force-dynamic";

export default async function PublicTicketsPage() {
  const supabase = createServiceRoleClient();
  const { data: events } = await supabase
    .from("events")
    .select("id, name, slug, description, event_date, venue, image_url, status")
    .eq("status", "active")
    .order("event_date", { ascending: true });

  const eventList = (events as Pick<Event, "id" | "name" | "slug" | "description" | "event_date" | "venue" | "image_url" | "status">[] | null) ?? [];

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-navy-700 px-4 py-4 text-center">
        <h1 className="text-lg font-bold text-gold-400">Eventos Gira</h1>
        <p className="text-xs text-navy-200">Compra tus entradas</p>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-6">
        <h2 className="mb-4 text-xl font-bold text-navy-700">Próximos eventos</h2>

        {eventList.length === 0 ? (
          <div className="rounded-2xl border border-navy-100 bg-white p-12 text-center shadow-sm">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="mx-auto mb-3 h-10 w-10 text-navy-300"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={1.5}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
              />
            </svg>
            <p className="text-sm text-navy-400">No hay eventos disponibles por el momento.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {eventList.map((e) => {
              const dateStr = new Date(e.event_date).toLocaleDateString("es-AR", {
                day: "2-digit",
                month: "long",
                year: "numeric",
                hour: "2-digit",
                minute: "2-digit",
              });

              return (
                <Link
                  key={e.id}
                  href={`/tickets/${e.slug}`}
                  className="group overflow-hidden rounded-2xl border border-navy-100 bg-white shadow-sm transition-all hover:border-gold-400 hover:shadow-md"
                >
                  {e.image_url ? (
                    <div className="aspect-video w-full overflow-hidden bg-navy-100">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={e.image_url}
                        alt={e.name}
                        className="h-full w-full object-cover transition-transform group-hover:scale-105"
                      />
                    </div>
                  ) : (
                    <div className="flex aspect-video w-full items-center justify-center bg-gradient-to-br from-navy-700 to-navy-900">
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        className="h-12 w-12 text-gold-400/40"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        strokeWidth={1.5}
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M15 5v2m0 4v2m0 4v2M5 5a2 2 0 00-2 2v3a2 2 0 110 4v3a2 2 0 002 2h14a2 2 0 002-2v-3a2 2 0 110-4V7a2 2 0 00-2-2H5z"
                        />
                      </svg>
                    </div>
                  )}
                  <div className="p-4">
                    <h3 className="font-semibold text-navy-700 group-hover:text-gold-600">
                      {e.name}
                    </h3>
                    <p className="mt-1 text-xs text-navy-400">📅 {dateStr}</p>
                    {e.venue && (
                      <p className="mt-0.5 text-xs text-navy-400">📍 {e.venue}</p>
                    )}
                    {e.description && (
                      <p className="mt-2 line-clamp-2 text-sm text-navy-500">{e.description}</p>
                    )}
                    <div className="mt-3 inline-flex items-center gap-1 text-sm font-semibold text-gold-600">
                      Ver entradas
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
                          d="M9 5l7 7-7 7"
                        />
                      </svg>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
