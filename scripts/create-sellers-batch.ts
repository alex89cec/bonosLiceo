import { createClient } from "@supabase/supabase-js";
import { Resend } from "resend";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const RESEND_API_KEY = process.env.RESEND_API_KEY!;
const FROM_EMAIL = process.env.RESEND_FROM_EMAIL || "Bonos Contribución <onboarding@resend.dev>";

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
const resend = new Resend(RESEND_API_KEY);

const sellers = [
  { email: "federicogonzalez516@gmail.com", name: "Federico Gonzalez" },
  { email: "juliandlv@hotmail.com", name: "Julian DLV" },
  { email: "frandemasi2003@gmail.com", name: "Fran Demasi" },
  { email: "martinfernandezfigarola@gmail.com", name: "Martin Fernandez Figarola" },
  { email: "joaquingale97@gmail.com", name: "Joaquin Gale" },
  { email: "luismoschesreinoso97@gmail.com", name: "Luis Mosches Reinoso" },
  { email: "carballedajulian@gmail.com", name: "Julian Carballeda" },
  { email: "jotatresamoblamiento@gmail.com", name: "Jota Tres Amoblamiento" },
  { email: "lautaroffecit@gmail.com", name: "Lautaro Ffecit" },
  { email: "gonnzafer@gmail.com", name: "Gonza Fer" },
  { email: "sabarrios02@gmail.com", name: "SA Barrios" },
  { email: "agustineblanco02@gmail.com", name: "Agustin E Blanco" },
  { email: "blanco.federicoj@gmail.com", name: "Federico J Blanco" },
  { email: "feercabrera@outlook.com", name: "Fer Cabrera" },
  { email: "sebastian_campagna@yahoo.com", name: "Sebastian Campagna" },
  { email: "jmpedratvillar@gmail.com", name: "JM Pedrat Villar" },
  { email: "fongidante@gmail.com", name: "Fongi Dante" },
  { email: "gabriel.14012@gmail.com", name: "Gabriel" },
  { email: "bautit49@gmail.com", name: "Bauti T" },
  { email: "bautiuribe2004@gmail.com", name: "Bauti Uribe" },
  { email: "vieiralautaronicolas@gmail.com", name: "Lautaro Nicolas Vieira" },
  { email: "lorenzo.villarroelprovasi@gmail.com", name: "Lorenzo Villarroel Provasi" },
  { email: "ivanpiak1984@gmail.com", name: "Ivan Piak" },
  { email: "inakisolaberrieta30@gmail.com", name: "Inaki Solaberrieta" },
  { email: "agustinalan76@gmail.com", name: "Agustin Alan" },
  { email: "adolfociallella@gmail.com", name: "Adolfo Ciallella" },
];

function generatePassword(length = 12): string {
  const upper = "ABCDEFGHJKLMNPQRSTUVWXYZ";
  const lower = "abcdefghjkmnpqrstuvwxyz";
  const digits = "23456789";
  const all = upper + lower + digits;
  let password =
    upper[Math.floor(Math.random() * upper.length)] +
    lower[Math.floor(Math.random() * lower.length)] +
    digits[Math.floor(Math.random() * digits.length)];
  for (let i = password.length; i < length; i++) {
    password += all[Math.floor(Math.random() * all.length)];
  }
  return password.split("").sort(() => Math.random() - 0.5).join("");
}

function generateSellerCode(name: string): string {
  const base = name
    .toUpperCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^A-Z]/g, "")
    .slice(0, 4);
  const num = String(Math.floor(Math.random() * 900) + 100);
  return (base || "SELL") + num;
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

const APP_URL = "https://www.bonosliceo.com";

async function createSeller(email: string, name: string) {
  const tempPassword = generatePassword();
  const sellerCode = generateSellerCode(name);

  console.log(`\n--- Creating: ${name} (${email}) ---`);

  // 1. Check if email already exists (and if admin, skip)
  const { data: existing } = await supabase
    .from("profiles")
    .select("id, email, role")
    .eq("email", email.toLowerCase())
    .maybeSingle();

  if (existing) {
    if (existing.role === "admin") {
      console.log(`  🛑 SKIPPED — is an ADMIN account`);
    } else {
      console.log(`  ⚠️  SKIPPED — email already exists (role: ${existing.role})`);
    }
    return;
  }

  // 2. Create auth user
  const { data: authData, error: authError } = await supabase.auth.admin.createUser({
    email: email.toLowerCase(),
    password: tempPassword,
    email_confirm: true,
  });

  if (authError) {
    console.error(`  ❌ Auth error: ${authError.message}`);
    return;
  }

  console.log(`  ✅ Auth user created: ${authData.user.id}`);

  // 3. Check seller_code uniqueness
  const { data: codeExists } = await supabase
    .from("profiles")
    .select("id")
    .eq("seller_code", sellerCode)
    .maybeSingle();

  const finalCode = codeExists ? sellerCode + Math.floor(Math.random() * 10) : sellerCode;

  // 4. Create profile
  const { error: profileError } = await supabase.from("profiles").upsert({
    id: authData.user.id,
    role: "seller",
    full_name: name,
    email: email.toLowerCase(),
    seller_code: finalCode,
    is_active: true,
    must_change_password: true,
  });

  if (profileError) {
    console.error(`  ❌ Profile error: ${profileError.message}`);
    await supabase.auth.admin.deleteUser(authData.user.id);
    return;
  }

  console.log(`  ✅ Profile created — code: ${finalCode}, pass: ${tempPassword}`);

  // 5. Send welcome email
  const loginUrl = `${APP_URL}/login`;
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
          <td style="padding:6px 0;text-align:right;font-family:monospace;font-weight:700;color:#1e293b;font-size:14px;">${email.toLowerCase()}</td>
        </tr>
        <tr>
          <td style="padding:6px 0;color:#78716c;font-size:14px;">Contraseña:</td>
          <td style="padding:6px 0;text-align:right;font-family:monospace;font-weight:700;color:#1e293b;font-size:14px;">${tempPassword}</td>
        </tr>
        <tr>
          <td style="padding:6px 0;color:#78716c;font-size:14px;">Código:</td>
          <td style="padding:6px 0;text-align:right;font-family:monospace;font-weight:700;color:#1e293b;font-size:14px;">${finalCode}</td>
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
    const { error: emailError } = await resend.emails.send({
      from: FROM_EMAIL,
      to: email.toLowerCase(),
      subject: "Bienvenido a Bonos Contribución",
      html,
    });

    if (emailError) {
      console.error(`  ⚠️  Email failed: ${emailError.message}`);
    } else {
      console.log(`  📧 Welcome email sent!`);
    }
  } catch (err) {
    console.error(`  ⚠️  Email error:`, err);
  }
}

async function main() {
  console.log("=== Batch Seller Creation ===\n");

  for (const s of sellers) {
    await createSeller(s.email, s.name);
  }

  console.log("\n=== Done! ===");
}

main();
