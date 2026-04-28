/**
 * One-shot: scan for approved/complimentary orders that don't have any
 * event_tickets generated, generate them, and send the buyer email.
 *
 * Run with: npx tsx --env-file=.env scripts/regenerate-missing-tickets.ts
 */
import { createClient } from "@supabase/supabase-js";
import crypto from "crypto";
import { Resend } from "resend";
import QRCode from "qrcode";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

const resend = new Resend(process.env.RESEND_API_KEY!);
const FROM_EMAIL =
  process.env.RESEND_FROM_EMAIL ||
  "Bonos Contribución <onboarding@resend.dev>";
const APP_URL = "https://www.bonosliceo.com";

const QR_SECRET = process.env.TICKET_QR_SECRET!;
if (!QR_SECRET) {
  console.error("TICKET_QR_SECRET is not set in .env");
  process.exit(1);
}

function signQrToken(ticketId: string): string {
  const hmac = crypto
    .createHmac("sha256", QR_SECRET)
    .update(ticketId)
    .digest("base64url");
  return `${ticketId}.${hmac}`;
}

async function qrAsDataUri(text: string): Promise<string> {
  return await QRCode.toDataURL(text, {
    errorCorrectionLevel: "M",
    type: "image/png",
    margin: 1,
    width: 320,
    color: { dark: "#0f172a", light: "#ffffff" },
  });
}

function emailLayout(content: string): string {
  return `<!DOCTYPE html>
<html lang="es">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#f4f6fa;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <div style="max-width:560px;margin:40px auto;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.06);">
    <div style="background:#1e293b;padding:24px 32px;text-align:center;">
      <h1 style="margin:0;color:#f5c542;font-size:20px;font-weight:700;">Eventos Gira</h1>
    </div>
    <div style="padding:32px;">${content}</div>
    <div style="padding:16px 32px;background:#f8fafc;text-align:center;border-top:1px solid #e2e8f0;">
      <p style="margin:0;color:#94a3b8;font-size:12px;">Este email fue enviado automáticamente.</p>
    </div>
  </div>
</body>
</html>`;
}

async function processOrder(orderId: string) {
  console.log(`\n→ Processing order ${orderId}`);

  // Fetch order
  const { data: order, error: orderErr } = await supabase
    .from("event_orders")
    .select(
      "id, event_id, buyer_id, seller_id, items, status, payment_method, total_amount",
    )
    .eq("id", orderId)
    .single();

  if (orderErr || !order) {
    console.log("  ✗ Order not found");
    return;
  }
  if (!["approved", "complimentary"].includes(order.status)) {
    console.log(`  ✗ Status is "${order.status}" — skipping`);
    return;
  }

  // Check existing tickets
  const { data: existing } = await supabase
    .from("event_tickets")
    .select("id")
    .eq("order_id", orderId);

  if (existing && existing.length > 0) {
    console.log(`  - Already has ${existing.length} tickets`);
    return;
  }

  // Generate tickets
  const items = order.items as Array<{
    ticket_type_id: string;
    name: string;
    quantity: number;
    unit_price: number;
    is_bundle?: boolean;
    bundle_items?: Array<{ ticket_type_id: string; quantity: number }> | null;
  }>;

  const isComplimentary = order.payment_method === "cortesia";
  const rows: any[] = [];

  for (const item of items) {
    const isBundle =
      item.is_bundle && item.bundle_items && item.bundle_items.length > 0;
    if (isBundle) {
      const ticketsPerBundle = item.bundle_items!.reduce(
        (s, c) => s + c.quantity,
        0,
      );
      const perTicketPrice =
        ticketsPerBundle > 0 ? item.unit_price / ticketsPerBundle : 0;
      for (let bIdx = 0; bIdx < item.quantity; bIdx++) {
        for (const component of item.bundle_items!) {
          for (let i = 0; i < component.quantity; i++) {
            const id = crypto.randomUUID();
            rows.push({
              id,
              event_id: order.event_id,
              ticket_type_id: component.ticket_type_id,
              buyer_id: order.buyer_id,
              seller_id: order.seller_id,
              order_id: order.id,
              qr_token: signQrToken(id),
              amount_paid: Number(perTicketPrice.toFixed(2)),
              is_complimentary: isComplimentary,
              parent_bundle_type_id: item.ticket_type_id,
              status: "valid",
            });
          }
        }
      }
    } else {
      for (let i = 0; i < item.quantity; i++) {
        const id = crypto.randomUUID();
        rows.push({
          id,
          event_id: order.event_id,
          ticket_type_id: item.ticket_type_id,
          buyer_id: order.buyer_id,
          seller_id: order.seller_id,
          order_id: order.id,
          qr_token: signQrToken(id),
          amount_paid: item.unit_price,
          is_complimentary: isComplimentary,
          parent_bundle_type_id: null,
          status: "valid",
        });
      }
    }
  }

  console.log(`  Inserting ${rows.length} tickets...`);
  const { error: insertErr } = await supabase
    .from("event_tickets")
    .insert(rows);
  if (insertErr) {
    console.log(`  ✗ Insert failed:`, insertErr.message);
    return;
  }
  console.log(`  ✓ Tickets inserted`);

  // Send email
  console.log("  Building email...");
  const { data: ev } = await supabase
    .from("events")
    .select("name, event_date, venue, image_url")
    .eq("id", order.event_id)
    .single();
  const { data: buyer } = await supabase
    .from("buyers")
    .select("email, full_name")
    .eq("id", order.buyer_id)
    .single();

  if (!ev || !buyer) {
    console.log("  ✗ Missing event or buyer for email");
    return;
  }

  const { data: tickets } = await supabase
    .from("event_tickets")
    .select(
      "id, qr_token, ticket_type:ticket_type_id (name), parent_bundle:parent_bundle_type_id (name)",
    )
    .eq("order_id", orderId)
    .order("created_at", { ascending: true });

  const dateStr = new Date(ev.event_date).toLocaleDateString("es-AR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  const isSingle = (tickets || []).length === 1;
  const greeting = buyer.full_name ? `¡Hola ${buyer.full_name}!` : "¡Hola!";

  const qrAttachments: { filename: string; content: string; cid: string }[] = [];
  const ticketCards: string[] = [];
  for (let i = 0; i < (tickets || []).length; i++) {
    const t = (tickets as any)[i];
    const cid = `qr-${i}@bonosliceo`;
    const dataUri = await qrAsDataUri(t.qr_token);
    const base64 = dataUri.replace(/^data:image\/png;base64,/, "");
    qrAttachments.push({
      filename: `entrada-${i + 1}.png`,
      content: base64,
      cid,
    });
    const typeName = t.ticket_type?.name || "Entrada";
    const bundleParentName = t.parent_bundle?.name || null;
    const bundleBadge = bundleParentName
      ? `<span style="display:inline-block;background:#ede9fe;color:#5b21b6;padding:3px 8px;border-radius:6px;font-size:11px;font-weight:600;margin-left:6px;">📦 ${bundleParentName}</span>`
      : "";
    ticketCards.push(`
      <div style="border:2px dashed #e2e8f0;border-radius:14px;padding:20px;margin:14px 0;text-align:center;background:#ffffff;">
        <p style="margin:0 0 4px;font-size:11px;color:#94a3b8;letter-spacing:1.5px;text-transform:uppercase;font-weight:600;">
          Entrada ${i + 1} de ${tickets!.length}
        </p>
        <p style="margin:0 0 10px;font-size:16px;color:#1e293b;font-weight:700;">${typeName}${bundleBadge}</p>
        <img src="cid:${cid}" alt="QR Entrada ${i + 1}" width="220" height="220" style="display:inline-block;border:1px solid #e2e8f0;border-radius:8px;background:#fff;" />
        <p style="margin:10px 0 0;font-size:10px;color:#94a3b8;font-family:monospace;word-break:break-all;">ID: ${t.id.slice(0, 8)}...</p>
      </div>`);
  }

  const eventImageHtml = ev.image_url
    ? `<div style="margin:0 -32px 20px;"><img src="${ev.image_url}" alt="${ev.name}" style="display:block;width:100%;max-height:200px;object-fit:cover;" /></div>`
    : "";

  const html = emailLayout(`
    <h2 style="margin:0 0 8px;color:#1e293b;font-size:22px;">${greeting}</h2>
    <p style="color:#64748b;font-size:15px;line-height:1.6;">
      ${isComplimentary ? "Recibiste una cortesía" : "Tu pago fue confirmado"} para <strong>${ev.name}</strong>. ${isSingle ? "Tu entrada está lista" : `Tus ${tickets!.length} entradas están listas`}.
    </p>
    ${eventImageHtml}
    <div style="background:#f8fafc;border-radius:12px;padding:16px 20px;margin:20px 0;">
      <p style="margin:0 0 4px;font-weight:600;color:#1e293b;font-size:15px;">${ev.name}</p>
      <p style="margin:0;color:#64748b;font-size:13px;line-height:1.5;">📅 ${dateStr}${ev.venue ? `<br>📍 ${ev.venue}` : ""}</p>
    </div>
    <div style="background:#fffbeb;border:2px solid #f59e0b;border-radius:12px;padding:16px 20px;margin:20px 0;text-align:center;">
      <p style="margin:0;font-size:14px;color:#78350f;line-height:1.5;">
        🎟️ <strong>Presentá ${isSingle ? "este QR" : "los QRs"} en la entrada</strong><br>
        <span style="font-size:12px;color:#a16207;">Cada persona necesita su propio QR.</span>
      </p>
    </div>
    ${ticketCards.join("")}
    <div style="text-align:center;margin:28px 0;">
      <a href="${APP_URL}/mis-entradas?email=${encodeURIComponent(buyer.email)}" style="display:inline-block;background:#f5c542;color:#1e293b;font-weight:700;font-size:15px;padding:14px 40px;border-radius:12px;text-decoration:none;">Ver todas mis entradas</a>
    </div>
    ${
      isComplimentary
        ? `<p style="text-align:center;color:#64748b;font-size:12px;">Cortesía emitida sin cargo.</p>`
        : `<p style="text-align:center;color:#64748b;font-size:12px;">Total pagado: <strong>$${order.total_amount.toLocaleString("es-AR")}</strong></p>`
    }
  `);

  const subject = isSingle
    ? `Tu entrada — ${ev.name}`
    : `Tus ${tickets!.length} entradas — ${ev.name}`;

  console.log(`  Sending to ${buyer.email}...`);
  const { error: emailErr } = await resend.emails.send({
    from: FROM_EMAIL,
    to: buyer.email,
    subject,
    html,
    attachments: qrAttachments.map((a) => ({
      filename: a.filename,
      content: a.content,
      contentId: a.cid,
    })),
  });
  if (emailErr) {
    console.log(`  ✗ Email error:`, emailErr);
    return;
  }
  console.log(`  ✓ Email sent`);
}

async function main() {
  // Find approved/complimentary orders without tickets
  const { data: orders } = await supabase
    .from("event_orders")
    .select("id, status, total_amount, items")
    .in("status", ["approved", "complimentary"])
    .order("created_at", { ascending: true });

  if (!orders || orders.length === 0) {
    console.log("No approved/complimentary orders found");
    return;
  }

  const orphans: string[] = [];
  for (const o of orders) {
    const { count } = await supabase
      .from("event_tickets")
      .select("id", { count: "exact", head: true })
      .eq("order_id", o.id);
    if ((count || 0) === 0) {
      orphans.push(o.id);
    }
  }

  console.log(`Found ${orphans.length} orphan orders (approved without tickets)`);
  for (const id of orphans) {
    await processOrder(id);
  }

  console.log("\nDone.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
