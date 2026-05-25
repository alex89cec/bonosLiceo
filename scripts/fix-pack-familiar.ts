/**
 * Make "Pack Familiar" of "Peña 25 Mayo - Liceo Militar" act as a bundle
 * of 2× General + 2× Menores de 12, WITHOUT invalidating the QRs that
 * the 8 existing buyers already have in their inboxes.
 *
 * Strategy:
 *  • The existing Pack Familiar ticket (1 per pack) is kept as-is —
 *    it stays the buyer's QR ("agrupador").
 *  • We add 4 component rows per pack (2 General + 2 Menor) with
 *    parent_bundle_type_id = Pack Familiar. These exist for stats
 *    only — they have no buyer-facing QR.
 *  • The ticket type itself is updated to declare bundle_items so
 *    future sales expand correctly.
 *
 * Run:
 *   npx tsx --env-file=.env scripts/fix-pack-familiar.ts            # dry-run
 *   npx tsx --env-file=.env scripts/fix-pack-familiar.ts --apply    # execute
 */
import { createClient } from "@supabase/supabase-js";
import crypto from "crypto";

const APPLY = process.argv.includes("--apply");
const EVENT_SLUG = "pena-25-mayo-liceo-militar";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

const QR_SECRET = process.env.TICKET_QR_SECRET!;
if (!QR_SECRET) {
  console.error("TICKET_QR_SECRET missing");
  process.exit(1);
}

function signQrToken(ticketId: string): string {
  const hmac = crypto
    .createHmac("sha256", QR_SECRET)
    .update(ticketId)
    .digest("base64url");
  return `${ticketId}.${hmac}`;
}

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

interface Order {
  id: string;
  event_id: string;
  buyer_id: string;
  seller_id: string | null;
  status: string;
  payment_method: string | null;
  items: OrderItem[];
  buyers: { email: string; full_name: string | null } | null;
}

interface TypeRow {
  id: string;
  name: string;
  bundle_items: BundleItem[] | null;
}

async function main() {
  console.log(
    `\n${APPLY ? "🟢 APPLY MODE" : "🟡 DRY RUN — use --apply to execute"}\n`,
  );

  const { data: ev } = await supabase
    .from("events")
    .select("id, name")
    .eq("slug", EVENT_SLUG)
    .single();
  if (!ev) {
    console.error("Event not found");
    process.exit(1);
  }
  console.log(`Event: ${ev.name} (${ev.id})\n`);

  const { data: types } = await supabase
    .from("event_ticket_types")
    .select("id, name, bundle_items")
    .eq("event_id", ev.id);

  const byName = (n: string) =>
    (types as TypeRow[]).find((t) => t.name.trim() === n);
  const pack = byName("Pack Familiar");
  const general = byName("General");
  const menores = byName("Menores de 12");

  if (!pack || !general || !menores) {
    console.error("Missing ticket types:", {
      pack: !!pack,
      general: !!general,
      menores: !!menores,
    });
    process.exit(1);
  }
  console.log(`Pack Familiar: ${pack.id}`);
  console.log(`General:       ${general.id}`);
  console.log(`Menores de 12: ${menores.id}\n`);

  const newBundleItems: BundleItem[] = [
    { ticket_type_id: general.id, quantity: 2 },
    { ticket_type_id: menores.id, quantity: 2 },
  ];

  // Step 1: turn Pack Familiar into a bundle (affects future sales only)
  console.log(
    `Step 1: set Pack Familiar.bundle_items = ${JSON.stringify(newBundleItems)}`,
  );
  if (APPLY) {
    const { error } = await supabase
      .from("event_ticket_types")
      .update({ bundle_items: newBundleItems })
      .eq("id", pack.id);
    if (error) {
      console.error("  ✗ update failed:", error.message);
      process.exit(1);
    }
    console.log("  ✓ updated");
  }

  // Step 2: find approved/complimentary orders with a Pack Familiar item
  const { data: orders } = await supabase
    .from("event_orders")
    .select(
      `id, event_id, buyer_id, seller_id, status, payment_method, items,
       buyers:buyer_id (email, full_name)`,
    )
    .eq("event_id", ev.id)
    .in("status", ["approved", "complimentary"]);

  const affected = ((orders ?? []) as unknown as Order[]).filter((o) =>
    o.items?.some((it) => it.ticket_type_id === pack.id),
  );
  console.log(`\nStep 2: ${affected.length} órdenes con Pack Familiar a procesar`);
  console.log(`         (no se borra ningún ticket viejo — el QR del comprador se respeta)\n`);

  let totalNewComponents = 0;

  for (const o of affected) {
    const packItem = o.items.find((it) => it.ticket_type_id === pack.id)!;
    const packQty = packItem.quantity;
    const componentsToAdd = packQty * 4;
    totalNewComponents += componentsToAdd;

    // Check if components were already added (idempotency)
    const { data: existing } = await supabase
      .from("event_tickets")
      .select("id, ticket_type_id, parent_bundle_type_id")
      .eq("order_id", o.id);

    const aggregatorTickets = (existing ?? []).filter(
      (t) => t.ticket_type_id === pack.id,
    );
    const componentTickets = (existing ?? []).filter(
      (t) => t.parent_bundle_type_id === pack.id,
    );

    console.log(
      `  Orden ${o.id.slice(0, 8)}…  ${o.buyers?.email}  packs=${packQty}`,
    );
    console.log(
      `    Tickets actuales: ${existing?.length ?? 0}  (agrupador=${aggregatorTickets.length}, componentes=${componentTickets.length})`,
    );

    if (componentTickets.length > 0) {
      console.log(`    ⏭  ya tiene componentes — salto (idempotente)`);
      totalNewComponents -= componentsToAdd; // adjust counter
      continue;
    }
    if (aggregatorTickets.length === 0) {
      console.log(`    ⚠  no encuentro el ticket agrupador del pack — salto`);
      totalNewComponents -= componentsToAdd;
      continue;
    }

    console.log(
      `    ➕ agregar ${componentsToAdd} componentes (${packQty * 2}× General + ${packQty * 2}× Menor)`,
    );

    if (!APPLY) continue;

    // Update order item snapshot so the line is officially a bundle now
    const newItems = o.items.map((it) =>
      it.ticket_type_id === pack.id
        ? { ...it, is_bundle: true, bundle_items: newBundleItems }
        : it,
    );
    const { error: updErr } = await supabase
      .from("event_orders")
      .update({ items: newItems })
      .eq("id", o.id);
    if (updErr) {
      console.log(`    ✗ order items update failed: ${updErr.message}`);
      continue;
    }

    // Insert component tickets (no QR-worth — they exist for counting / scan-cascade)
    const isCompli = o.payment_method === "cortesia";
    // Aggregator already carries the $25k price; components are accounted at $0
    // to keep the existing order_total reconciliation untouched.
    const newRows: Array<{
      id: string;
      event_id: string;
      ticket_type_id: string;
      buyer_id: string;
      seller_id: string | null;
      order_id: string;
      qr_token: string;
      amount_paid: number;
      is_complimentary: boolean;
      parent_bundle_type_id: string;
      status: "valid";
    }> = [];
    for (let p = 0; p < packQty; p++) {
      for (const comp of newBundleItems) {
        for (let i = 0; i < comp.quantity; i++) {
          const id = crypto.randomUUID();
          newRows.push({
            id,
            event_id: o.event_id,
            ticket_type_id: comp.ticket_type_id,
            buyer_id: o.buyer_id,
            seller_id: o.seller_id,
            order_id: o.id,
            qr_token: signQrToken(id),
            amount_paid: 0,
            is_complimentary: isCompli,
            parent_bundle_type_id: pack.id,
            status: "valid",
          });
        }
      }
    }
    const { error: insErr } = await supabase
      .from("event_tickets")
      .insert(newRows);
    if (insErr) {
      console.log(`    ✗ insert failed: ${insErr.message}`);
      continue;
    }
    console.log(`    ✓ ${newRows.length} componentes insertados`);
  }

  console.log(`\n${"=".repeat(60)}`);
  console.log(
    `${APPLY ? "✓ Done." : "Dry-run done."}  Nuevos componentes a insertar: ${totalNewComponents}`,
  );
  console.log(
    `Tickets en BD pasan de 155 → ${155 + totalNewComponents} (los 9 agrupadores se mantienen intactos).`,
  );
  if (!APPLY) console.log(`Re-correr con --apply para ejecutar.`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
