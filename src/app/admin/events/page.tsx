import Link from "next/link";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { Event } from "@/types/database";

export default async function AdminEventsPage() {
  const supabase = await createServerSupabaseClient();
  const { data: events } = await supabase
    .from("events")
    .select("*")
    .order("event_date", { ascending: false });

  const eventList = (events as Event[] | null) ?? [];

  // Fetch ticket counts per event
  const eventIds = eventList.map((e) => e.id);
  const soldMap: Record<string, number> = {};
  if (eventIds.length > 0) {
    const { data: ticketRows } = await supabase
      .from("event_tickets")
      .select("event_id")
      .in("event_id", eventIds)
      .in("status", ["valid", "used"]);

    for (const t of ticketRows || []) {
      soldMap[t.event_id] = (soldMap[t.event_id] || 0) + 1;
    }
  }

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h2 className="text-xl font-bold">Eventos</h2>
        <a href="/admin/events/new" className="btn-primary">
          + Nuevo evento
        </a>
      </div>

      <div className="space-y-3">
        {eventList.map((event) => {
          const sold = soldMap[event.id] ?? 0;
          const dateStr = new Date(event.event_date).toLocaleDateString("es-AR", {
            day: "2-digit",
            month: "short",
            year: "numeric",
            hour: "2-digit",
            minute: "2-digit",
          });

          return (
            <Link
              key={event.id}
              href={`/admin/events/${event.id}/edit`}
              className="card block transition hover:shadow-md"
            >
              <div className="flex items-center justify-between">
                <div className="min-w-0 flex-1">
                  <h3 className="font-semibold">{event.name}</h3>
                  <p className="text-sm text-gray-500">/{event.slug}</p>
                </div>
                <div className="flex items-center gap-2">
                  <span
                    className={`rounded-full px-3 py-1 text-xs font-medium ${
                      event.status === "active"
                        ? "bg-green-100 text-green-700"
                        : event.status === "past"
                          ? "bg-gray-100 text-gray-600"
                          : event.status === "cancelled"
                            ? "bg-red-100 text-red-700"
                            : "bg-yellow-100 text-yellow-700"
                    }`}
                  >
                    {event.status === "draft"
                      ? "Borrador"
                      : event.status === "active"
                        ? "Activo"
                        : event.status === "past"
                          ? "Pasado"
                          : "Cancelado"}
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
              <div className="mt-2 flex flex-wrap gap-4 text-sm text-gray-500">
                <span className="flex items-center gap-1">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  {dateStr}
                </span>
                {event.venue && (
                  <span className="flex items-center gap-1">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a2 2 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                    {event.venue}
                  </span>
                )}
                {sold > 0 && (
                  <span className="text-green-600">
                    {sold} entrada{sold !== 1 ? "s" : ""} vendida{sold !== 1 ? "s" : ""}
                  </span>
                )}
              </div>
            </Link>
          );
        })}

        {eventList.length === 0 && (
          <p className="py-12 text-center text-gray-500">
            No hay eventos. Crea el primero.
          </p>
        )}
      </div>
    </div>
  );
}
