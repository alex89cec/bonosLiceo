import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

const FROM_EMAIL = process.env.RESEND_FROM_EMAIL || "Bonos Contribución <onboarding@resend.dev>";

function getAppUrl(): string {
  return "https://www.bonosliceo.com";
}

function emailLayout(content: string): string {
  return `<!DOCTYPE html>
<html lang="es">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#f4f6fa;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <div style="max-width:560px;margin:40px auto;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.06);">
    <div style="background:#1e293b;padding:24px 32px;text-align:center;">
      <h1 style="margin:0;color:#f5c542;font-size:20px;font-weight:700;">Bonos Contribución</h1>
    </div>
    <div style="padding:32px;">
      ${content}
    </div>
    <div style="padding:16px 32px;background:#f8fafc;text-align:center;border-top:1px solid #e2e8f0;">
      <p style="margin:0;color:#94a3b8;font-size:12px;">Este email fue enviado automáticamente. No respondas a este mensaje.</p>
    </div>
  </div>
</body>
</html>`;
}

export async function sendWelcomeEmail(
  name: string,
  email: string,
  tempPassword: string,
  sellerCode: string,
): Promise<{ success: boolean; error?: string }> {
  const loginUrl = `${getAppUrl()}/login`;

  const html = emailLayout(`
    <h2 style="margin:0 0 8px;color:#1e293b;font-size:22px;">¡Bienvenido, ${name}!</h2>
    <p style="color:#64748b;font-size:15px;line-height:1.6;">
      Se ha creado tu cuenta en la plataforma de Bonos Contribución. A continuación encontrarás tus credenciales de acceso.
    </p>

    <div style="background:#fffbeb;border:2px dashed #f59e0b;border-radius:12px;padding:20px;margin:24px 0;">
      <p style="margin:0 0 12px;font-weight:700;color:#92400e;font-size:14px;">Tus credenciales</p>
      <table style="width:100%;border-collapse:collapse;">
        <tr>
          <td style="padding:6px 0;color:#78716c;font-size:14px;">Email:</td>
          <td style="padding:6px 0;text-align:right;font-family:monospace;font-weight:700;color:#1e293b;font-size:14px;">${email}</td>
        </tr>
        <tr>
          <td style="padding:6px 0;color:#78716c;font-size:14px;">Contraseña:</td>
          <td style="padding:6px 0;text-align:right;font-family:monospace;font-weight:700;color:#1e293b;font-size:14px;">${tempPassword}</td>
        </tr>
        <tr>
          <td style="padding:6px 0;color:#78716c;font-size:14px;">Código:</td>
          <td style="padding:6px 0;text-align:right;font-family:monospace;font-weight:700;color:#1e293b;font-size:14px;">${sellerCode}</td>
        </tr>
      </table>
    </div>

    <div style="text-align:center;margin:28px 0;">
      <a href="${loginUrl}" style="display:inline-block;background:#f5c542;color:#1e293b;font-weight:700;font-size:15px;padding:14px 40px;border-radius:12px;text-decoration:none;">
        Iniciar sesión
      </a>
    </div>

    <p style="color:#ef4444;font-size:13px;font-weight:600;text-align:center;">
      Deberás cambiar tu contraseña en el primer inicio de sesión.
    </p>
  `);

  try {
    const { error } = await resend.emails.send({
      from: FROM_EMAIL,
      to: email,
      subject: "Bienvenido a Bonos Contribución",
      html,
    });

    if (error) {
      console.error("Resend welcome email error:", error);
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (err) {
    console.error("Email send error:", err);
    return { success: false, error: "Error al enviar email" };
  }
}

// ── Buyer confirmation email ──

export interface BuyerEmailData {
  buyerName: string | null;
  buyerEmail: string;
  campaignName: string;
  flyerUrl: string | null;
  ticketNumbers: string[];
  ticketPrice: number;
  totalAmount: number;
  paymentMode: "full_payment" | "installments";
  paymentStatus: string;
  sellerName: string;
  installments?: {
    number: number;
    amount: number;
    due_date: string;
    status: string;
  }[];
  reservationIds: string[];
}

export async function sendBuyerConfirmationEmail(
  data: BuyerEmailData,
): Promise<{ success: boolean; error?: string }> {
  const appUrl = getAppUrl();
  const greeting = data.buyerName ? `¡Hola ${data.buyerName}!` : "¡Hola!";
  const isSingle = data.ticketNumbers.length === 1;
  const subject = isSingle
    ? `Tu Bono #${data.ticketNumbers[0]} — ${data.campaignName}`
    : `Tus ${data.ticketNumbers.length} Bonos — ${data.campaignName}`;

  const numbersHtml = data.ticketNumbers
    .map(
      (n) =>
        `<span style="display:inline-block;background:#f5c542;color:#1e293b;font-family:monospace;font-size:20px;font-weight:800;padding:8px 16px;border-radius:10px;margin:4px;">#${n}</span>`,
    )
    .join(" ");

  const flyerHtml = data.flyerUrl
    ? `<div style="margin:20px 0;text-align:center;">
        <img src="${data.flyerUrl}" alt="${data.campaignName}" style="max-width:100%;border-radius:12px;border:1px solid #e2e8f0;" />
      </div>`
    : "";

  const paymentModeLabel =
    data.paymentMode === "full_payment"
      ? "Pago completo"
      : `En cuotas (${data.installments?.length || 0})`;

  const paymentStatusLabel =
    data.paymentStatus === "completed"
      ? "Pagado"
      : data.paymentStatus === "partial"
        ? "Pago parcial"
        : "Pendiente";

  const paymentStatusColor =
    data.paymentStatus === "completed"
      ? "#16a34a"
      : data.paymentStatus === "partial"
        ? "#d97706"
        : "#dc2626";

  let installmentsHtml = "";
  if (
    data.paymentMode === "installments" &&
    data.installments &&
    data.installments.length > 0
  ) {
    const rows = data.installments
      .map((inst) => {
        const statusColor =
          inst.status === "paid"
            ? "#16a34a"
            : inst.status === "overdue"
              ? "#dc2626"
              : "#64748b";
        const statusLabel =
          inst.status === "paid"
            ? "Pagada"
            : inst.status === "overdue"
              ? "Vencida"
              : "Pendiente";
        const dueDate = new Date(inst.due_date).toLocaleDateString("es-AR", {
          day: "2-digit",
          month: "short",
          year: "numeric",
        });
        return `<tr>
          <td style="padding:8px 12px;border-bottom:1px solid #f1f5f9;font-size:13px;color:#475569;">Cuota ${inst.number}</td>
          <td style="padding:8px 12px;border-bottom:1px solid #f1f5f9;font-size:13px;color:#1e293b;font-weight:600;text-align:right;">$${inst.amount.toLocaleString("es-AR")}</td>
          <td style="padding:8px 12px;border-bottom:1px solid #f1f5f9;font-size:13px;color:#475569;text-align:right;">${dueDate}</td>
          <td style="padding:8px 12px;border-bottom:1px solid #f1f5f9;font-size:13px;font-weight:600;text-align:right;color:${statusColor};">${statusLabel}</td>
        </tr>`;
      })
      .join("");

    installmentsHtml = `
      <div style="margin:20px 0;">
        <p style="margin:0 0 8px;font-weight:700;color:#1e293b;font-size:14px;">Detalle de cuotas</p>
        <table style="width:100%;border-collapse:collapse;background:#f8fafc;border-radius:8px;overflow:hidden;">
          <thead>
            <tr style="background:#e2e8f0;">
              <th style="padding:8px 12px;text-align:left;font-size:11px;color:#64748b;font-weight:600;">CUOTA</th>
              <th style="padding:8px 12px;text-align:right;font-size:11px;color:#64748b;font-weight:600;">MONTO</th>
              <th style="padding:8px 12px;text-align:right;font-size:11px;color:#64748b;font-weight:600;">VENCIMIENTO</th>
              <th style="padding:8px 12px;text-align:right;font-size:11px;color:#64748b;font-weight:600;">ESTADO</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      </div>`;
  }

  const checkUrl = `${appUrl}/mis-numeros?email=${encodeURIComponent(data.buyerEmail)}`;

  const html = emailLayout(`
    <h2 style="margin:0 0 8px;color:#1e293b;font-size:22px;">${greeting}</h2>
    <p style="color:#64748b;font-size:15px;line-height:1.6;">
      ${isSingle ? "Tu bono ha sido reservado" : "Tus bonos han sido reservados"} exitosamente para la campaña <strong style="color:#1e293b;">${data.campaignName}</strong>.
    </p>

    ${flyerHtml}

    <!-- Ticket numbers -->
    <div style="text-align:center;margin:24px 0;">
      <p style="margin:0 0 8px;font-size:12px;color:#94a3b8;text-transform:uppercase;letter-spacing:1px;font-weight:600;">
        ${isSingle ? "Tu número" : "Tus números"}
      </p>
      ${numbersHtml}
    </div>

    <!-- Details table -->
    <div style="background:#f8fafc;border-radius:12px;padding:16px 20px;margin:20px 0;">
      <table style="width:100%;border-collapse:collapse;">
        <tr>
          <td style="padding:8px 0;color:#64748b;font-size:14px;">Campaña</td>
          <td style="padding:8px 0;text-align:right;font-weight:600;color:#1e293b;font-size:14px;">${data.campaignName}</td>
        </tr>
        <tr>
          <td style="padding:8px 0;color:#64748b;font-size:14px;border-top:1px solid #e2e8f0;">Precio unitario</td>
          <td style="padding:8px 0;text-align:right;font-weight:600;color:#1e293b;font-size:14px;border-top:1px solid #e2e8f0;">$${data.ticketPrice.toLocaleString("es-AR")}</td>
        </tr>
        ${data.ticketNumbers.length > 1 ? `<tr>
          <td style="padding:8px 0;color:#64748b;font-size:14px;border-top:1px solid #e2e8f0;">Cantidad</td>
          <td style="padding:8px 0;text-align:right;font-weight:600;color:#1e293b;font-size:14px;border-top:1px solid #e2e8f0;">${data.ticketNumbers.length} bonos</td>
        </tr>` : ""}
        <tr>
          <td style="padding:8px 0;color:#64748b;font-size:14px;border-top:1px solid #e2e8f0;">Total</td>
          <td style="padding:8px 0;text-align:right;font-weight:800;color:#1e293b;font-size:18px;border-top:1px solid #e2e8f0;">$${data.totalAmount.toLocaleString("es-AR")}</td>
        </tr>
        <tr>
          <td style="padding:8px 0;color:#64748b;font-size:14px;border-top:1px solid #e2e8f0;">Modo de pago</td>
          <td style="padding:8px 0;text-align:right;font-weight:600;color:#1e293b;font-size:14px;border-top:1px solid #e2e8f0;">${paymentModeLabel}</td>
        </tr>
        <tr>
          <td style="padding:8px 0;color:#64748b;font-size:14px;border-top:1px solid #e2e8f0;">Estado</td>
          <td style="padding:8px 0;text-align:right;font-weight:700;font-size:14px;border-top:1px solid #e2e8f0;color:${paymentStatusColor};">${paymentStatusLabel}</td>
        </tr>
        <tr>
          <td style="padding:8px 0;color:#64748b;font-size:14px;border-top:1px solid #e2e8f0;">Vendedor</td>
          <td style="padding:8px 0;text-align:right;font-weight:600;color:#1e293b;font-size:14px;border-top:1px solid #e2e8f0;">${data.sellerName}</td>
        </tr>
      </table>
    </div>

    ${installmentsHtml}

    <div style="text-align:center;margin:28px 0;">
      <a href="${checkUrl}" style="display:inline-block;background:#f5c542;color:#1e293b;font-weight:700;font-size:15px;padding:14px 40px;border-radius:12px;text-decoration:none;">
        Ver mis bonos
      </a>
    </div>

    <p style="color:#94a3b8;font-size:12px;text-align:center;">
      Guardá este email como comprobante de tu reserva.
    </p>
  `);

  try {
    const { error } = await resend.emails.send({
      from: FROM_EMAIL,
      to: data.buyerEmail,
      subject,
      html,
    });

    if (error) {
      console.error("Resend buyer email error:", error);
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (err) {
    console.error("Buyer email send error:", err);
    return { success: false, error: "Error al enviar email al comprador" };
  }
}

export async function sendPasswordResetEmail(
  name: string,
  email: string,
  newPassword: string,
): Promise<{ success: boolean; error?: string }> {
  const loginUrl = `${getAppUrl()}/login`;

  const html = emailLayout(`
    <h2 style="margin:0 0 8px;color:#1e293b;font-size:22px;">Nueva contraseña</h2>
    <p style="color:#64748b;font-size:15px;line-height:1.6;">
      Hola ${name}, un administrador ha restablecido tu contraseña. Usa la nueva contraseña temporal para iniciar sesión.
    </p>

    <div style="background:#eff6ff;border:2px solid #3b82f6;border-radius:12px;padding:20px;margin:24px 0;">
      <p style="margin:0 0 12px;font-weight:700;color:#1e40af;font-size:14px;">Nueva contraseña temporal</p>
      <table style="width:100%;border-collapse:collapse;">
        <tr>
          <td style="padding:6px 0;color:#64748b;font-size:14px;">Email:</td>
          <td style="padding:6px 0;text-align:right;font-family:monospace;font-weight:700;color:#1e293b;font-size:14px;">${email}</td>
        </tr>
        <tr>
          <td style="padding:6px 0;color:#64748b;font-size:14px;">Contraseña:</td>
          <td style="padding:6px 0;text-align:right;font-family:monospace;font-weight:700;color:#1e293b;font-size:14px;">${newPassword}</td>
        </tr>
      </table>
    </div>

    <div style="text-align:center;margin:28px 0;">
      <a href="${loginUrl}" style="display:inline-block;background:#f5c542;color:#1e293b;font-weight:700;font-size:15px;padding:14px 40px;border-radius:12px;text-decoration:none;">
        Iniciar sesión
      </a>
    </div>

    <p style="color:#ef4444;font-size:13px;font-weight:600;text-align:center;">
      Deberás cambiar tu contraseña en el primer inicio de sesión.
    </p>
  `);

  try {
    const { error } = await resend.emails.send({
      from: FROM_EMAIL,
      to: email,
      subject: "Nueva contraseña — Bonos Contribución",
      html,
    });

    if (error) {
      console.error("Resend reset email error:", error);
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (err) {
    console.error("Email send error:", err);
    return { success: false, error: "Error al enviar email" };
  }
}

// ── Transfer instructions email (preventa) ──

export interface TransferInstructionsData {
  buyerName: string | null;
  buyerEmail: string;
  eventName: string;
  eventDate: string;
  eventVenue: string | null;
  items: { name: string; quantity: number; unit_price: number }[];
  totalAmount: number;
  // Transfer data
  holderName: string | null;
  cbu: string | null;
  alias: string | null;
  bank: string | null;
  idNumber: string | null;
  instructions: string | null;
  // Seller (recipient of receipt)
  sellerName: string | null;
  sellerEmail: string | null;
}

export async function sendTransferInstructionsEmail(
  data: TransferInstructionsData,
): Promise<{ success: boolean; error?: string }> {
  const greeting = data.buyerName ? `¡Hola ${data.buyerName}!` : "¡Hola!";
  const dateStr = new Date(data.eventDate).toLocaleDateString("es-AR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  const itemsRows = data.items
    .map(
      (it) => `
      <tr>
        <td style="padding:8px 0;color:#475569;font-size:14px;">${it.quantity}× ${it.name}</td>
        <td style="padding:8px 0;text-align:right;font-weight:600;color:#1e293b;font-size:14px;">$${(it.unit_price * it.quantity).toLocaleString("es-AR")}</td>
      </tr>`,
    )
    .join("");

  // Build transfer rows dynamically (only show fields that have a value)
  const transferRows: { label: string; value: string; mono?: boolean }[] = [];
  if (data.holderName) transferRows.push({ label: "Titular", value: data.holderName });
  if (data.bank) transferRows.push({ label: "Banco", value: data.bank });
  if (data.cbu) transferRows.push({ label: "CBU", value: data.cbu, mono: true });
  if (data.alias) transferRows.push({ label: "Alias", value: data.alias, mono: true });
  if (data.idNumber) transferRows.push({ label: "CUIT/DNI", value: data.idNumber, mono: true });

  const transferRowsHtml = transferRows
    .map(
      (r) => `
        <tr>
          <td style="padding:8px 0;color:#64748b;font-size:14px;width:80px;">${r.label}</td>
          <td style="padding:8px 0;text-align:right;font-weight:700;color:#1e293b;font-size:14px;${r.mono ? "font-family:monospace;" : ""}">${r.value}</td>
        </tr>`,
    )
    .join("");

  const sellerInfo =
    data.sellerName || data.sellerEmail
      ? `
    <div style="background:#fff7ed;border:2px solid #fb923c;border-radius:12px;padding:20px;margin:20px 0;">
      <p style="margin:0 0 6px;font-weight:700;color:#9a3412;font-size:14px;">📤 Una vez hecha la transferencia</p>
      <p style="margin:0;color:#7c2d12;font-size:14px;line-height:1.5;">
        Enviá el comprobante a tu vendedor:
        ${data.sellerName ? `<strong>${data.sellerName}</strong>` : ""}
        ${data.sellerEmail ? `<br><a href="mailto:${data.sellerEmail}" style="color:#9a3412;">${data.sellerEmail}</a>` : ""}
      </p>
    </div>`
      : `
    <div style="background:#fff7ed;border:2px solid #fb923c;border-radius:12px;padding:20px;margin:20px 0;">
      <p style="margin:0 0 6px;font-weight:700;color:#9a3412;font-size:14px;">📤 Una vez hecha la transferencia</p>
      <p style="margin:0;color:#7c2d12;font-size:14px;line-height:1.5;">
        Enviá el comprobante a quien te vendió la entrada para confirmar la compra.
      </p>
    </div>`;

  const html = emailLayout(`
    <h2 style="margin:0 0 8px;color:#1e293b;font-size:22px;">${greeting}</h2>
    <p style="color:#64748b;font-size:15px;line-height:1.6;">
      Tu reserva para <strong style="color:#1e293b;">${data.eventName}</strong> está esperando el pago. A continuación encontrarás los datos para la transferencia.
    </p>

    <!-- Event info -->
    <div style="background:#f8fafc;border-radius:12px;padding:16px 20px;margin:20px 0;">
      <p style="margin:0 0 4px;font-weight:600;color:#1e293b;font-size:15px;">${data.eventName}</p>
      <p style="margin:0;color:#64748b;font-size:13px;">
        📅 ${dateStr}
        ${data.eventVenue ? `<br>📍 ${data.eventVenue}` : ""}
      </p>
    </div>

    <!-- Items -->
    <div style="margin:20px 0;">
      <p style="margin:0 0 8px;font-weight:700;color:#1e293b;font-size:14px;">Detalle</p>
      <table style="width:100%;border-collapse:collapse;">
        ${itemsRows}
        <tr style="border-top:1px solid #e2e8f0;">
          <td style="padding:12px 0;color:#1e293b;font-size:15px;font-weight:700;">Total a transferir</td>
          <td style="padding:12px 0;text-align:right;font-weight:800;color:#1e293b;font-size:18px;">$${data.totalAmount.toLocaleString("es-AR")}</td>
        </tr>
      </table>
    </div>

    <!-- Transfer data -->
    <div style="background:#fffbeb;border:2px solid #f59e0b;border-radius:12px;padding:20px;margin:24px 0;">
      <p style="margin:0 0 12px;font-weight:700;color:#92400e;font-size:14px;">💸 Datos para transferencia</p>
      <table style="width:100%;border-collapse:collapse;">
        ${transferRowsHtml}
      </table>
      ${data.instructions ? `<p style="margin:12px 0 0;padding-top:12px;border-top:1px solid #fde68a;color:#78350f;font-size:13px;line-height:1.5;">${data.instructions}</p>` : ""}
    </div>

    ${sellerInfo}

    <p style="color:#94a3b8;font-size:12px;text-align:center;margin-top:24px;">
      Cuando se confirme el pago vas a recibir tus entradas con QR por email.
    </p>
  `);

  try {
    const { error } = await resend.emails.send({
      from: FROM_EMAIL,
      to: data.buyerEmail,
      subject: `Datos para tu transferencia — ${data.eventName}`,
      html,
    });

    if (error) {
      console.error("Resend transfer email error:", error);
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (err) {
    console.error("Transfer email send error:", err);
    return { success: false, error: "Error al enviar email" };
  }
}
