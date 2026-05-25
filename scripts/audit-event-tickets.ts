/**
 * Read-only audit: verify how event_tickets are being counted per event,
 * and confirm that bundle (e.g. "Grupo Familiar 2A+2M") orders are
 * expanded into individual component tickets.
 *
 * Run:
 *   npx tsx --env-file=.env scripts/audit-event-tickets.ts            # all events
 *   npx tsx --env-file=.env scripts/audit-event-tickets.ts <slug|id>  # one event
 */
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

interface BundleItem {
  ticket_type_id: string;
  quantity: number;
}

interface OrderItem {
  ticket_type_id: string;
  name: string;
  quantity: number;
  unit_price: number;
  is_bundle?: boolean;
  bundle_items?: BundleItem[] | null;
}

interface TicketType {
  id: string;
  name: string;
  bundle_items: BundleItem[] | null;
}

interface Ticket {
  id: string;
  ticket_type_id: string;
  parent_bundle_type_id: string | null;
  status: string;
  order_id: string;
}

interface Order {
  id: string;
  status: string;
  items: OrderItem[] | null;
}

interface EventRow {
  id: string;
  name: string;
  slug: string;
  status: string;
}

const COUNTED = new Set(["valid", "used"]);

async function auditEvent(ev: EventRow) {
  console.log(`\n${"=".repeat(72)}`);
  console.log(`📅 ${ev.name}  (slug: ${ev.slug}, status: ${ev.status})`);
  console.log("=".repeat(72));

  const [{ data: types }, { data: orders }, { data: tickets }] =
    await Promise.all([
      supabase
        .from("event_ticket_types")
        .select("id, name, bundle_items")
        .eq("event_id", ev.id),
      supabase
        .from("event_orders")
        .select("id, status, items")
        .eq("event_id", ev.id),
      supabase
        .from("event_tickets")
        .select("id, ticket_type_id, parent_bundle_type_id, status, order_id")
        .eq("event_id", ev.id),
    ]);

  const tts = (types ?? []) as TicketType[];
  const ords = (orders ?? []) as Order[];
  const tks = (tickets ?? []) as Ticket[];
  const validTks = tks.filter((t) => COUNTED.has(t.status));

  const typeName = new Map(tts.map((t) => [t.id, t.name]));

  // High-level counts
  const approved = ords.filter((o) => o.status === "approved").length;
  const compli = ords.filter((o) => o.status === "complimentary").length;
  const pending = ords.filter(
    (o) => o.status === "pending_review" || o.status === "awaiting_receipt",
  ).length;
  console.log(`Órdenes: ${ords.length} total`);
  console.log(`  • approved:     ${approved}`);
  console.log(`  • complimentary:${compli}`);
  console.log(`  • pending:      ${pending}`);
  console.log(`Tickets valid|used: ${validTks.length}   (= card "Entradas")`);

  // Per-type breakdown
  console.log(`\nDesglose por tipo:`);
  for (const t of tts) {
    const isBundle =
      Array.isArray(t.bundle_items) && t.bundle_items.length > 0;
    if (isBundle) {
      const perBundle = t.bundle_items!.reduce((s, c) => s + c.quantity, 0);
      const generated = validTks.filter(
        (tk) => tk.parent_bundle_type_id === t.id,
      ).length;
      const packs = Math.ceil(generated / Math.max(perBundle, 1));
      const components = t
        .bundle_items!.map(
          (bi) => `${bi.quantity}× ${typeName.get(bi.ticket_type_id) || "?"}`,
        )
        .join(" + ");
      console.log(
        `  📦 ${t.name}  [${components}, ${perBundle} tickets/pack]`,
      );
      console.log(
        `      packs vendidos: ${packs}   tickets generados: ${generated}  ${
          generated % perBundle === 0
            ? "✓ múltiplo exacto"
            : "⚠ NO múltiplo — posible orden parcial"
        }`,
      );
    } else {
      const individual = validTks.filter(
        (tk) => tk.ticket_type_id === t.id && !tk.parent_bundle_type_id,
      ).length;
      const asBundleChild = validTks.filter(
        (tk) => tk.ticket_type_id === t.id && !!tk.parent_bundle_type_id,
      ).length;
      console.log(`     ${t.name}`);
      console.log(
        `      sueltos: ${individual}   como parte de un pack: ${asBundleChild}   total: ${individual + asBundleChild}`,
      );
    }
  }

  // Sanity: sum of per-type valid tickets should equal total
  const sumPerType = tts.reduce((s, t) => {
    return (
      s +
      validTks.filter((tk) => {
        const isBundle =
          Array.isArray(t.bundle_items) && t.bundle_items.length > 0;
        if (isBundle) return tk.parent_bundle_type_id === t.id;
        return tk.ticket_type_id === t.id && !tk.parent_bundle_type_id;
      }).length
    );
  }, 0);
  console.log(
    `\nSuma desglose = ${sumPerType}   vs   total tickets = ${validTks.length}   ${
      sumPerType === validTks.length ? "✓" : "⚠ DESCUADRA"
    }`,
  );

  // Show a couple of bundle orders expanded, to confirm visually
  const bundleOrders = ords
    .filter(
      (o) =>
        (o.status === "approved" || o.status === "complimentary") &&
        Array.isArray(o.items) &&
        o.items.some((it) => it.is_bundle),
    )
    .slice(0, 3);

  if (bundleOrders.length > 0) {
    console.log(`\nMuestras de órdenes con bundle (max 3):`);
    for (const o of bundleOrders) {
      const orderTks = tks.filter((t) => t.order_id === o.id);
      console.log(`  Orden ${o.id.slice(0, 8)}… (${o.status})`);
      for (const it of o.items ?? []) {
        const label = it.is_bundle
          ? `📦 ${it.quantity}× ${it.name}`
          : `${it.quantity}× ${it.name}`;
        console.log(`    item: ${label}`);
      }
      const byType = new Map<string, number>();
      for (const tk of orderTks) {
        const key =
          (typeName.get(tk.ticket_type_id) || "?") +
          (tk.parent_bundle_type_id
            ? ` (vía ${typeName.get(tk.parent_bundle_type_id) || "?"})`
            : "");
        byType.set(key, (byType.get(key) ?? 0) + 1);
      }
      console.log(
        `    → tickets generados (${orderTks.length}): ${
          [...byType.entries()].map(([k, v]) => `${v}× ${k}`).join(", ") ||
          "(ninguno)"
        }`,
      );
    }
  } else {
    console.log(`\n(sin órdenes con bundle aprobadas para mostrar)`);
  }
}

async function main() {
  const filter = process.argv[2];
  let q = supabase
    .from("events")
    .select("id, name, slug, status")
    .order("event_date", { ascending: false });
  if (filter) {
    const isUuid =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
        filter,
      );
    q = isUuid ? q.eq("id", filter) : q.eq("slug", filter);
  }
  const { data: events, error } = await q;
  if (error) {
    console.error("Error fetching events:", error.message);
    process.exit(1);
  }
  if (!events || events.length === 0) {
    console.log("No events found.");
    return;
  }
  for (const ev of events as EventRow[]) {
    await auditEvent(ev);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
