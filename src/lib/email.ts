import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

const FROM_EMAIL = process.env.RESEND_FROM_EMAIL || "Bonos Contribución <onboarding@resend.dev>";

function getAppUrl(): string {
  if (process.env.NEXT_PUBLIC_APP_URL) return process.env.NEXT_PUBLIC_APP_URL;
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return "http://localhost:3000";
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
