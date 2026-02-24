import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const ADMINS = [
  { email: "matias.condurso@gmail.com", name: "Matias Condurso" },
  { email: "nickimedi2000@gmail.com", name: "Nicki Medi" },
  { email: "santosfecit@gmail.com", name: "Santos Fecit" },
  { email: "carballedajulian@gmail.com", name: "Julian Carballeda" },
  { email: "santiago.prieto451015@gmail.com", name: "Santiago Prieto" },
  { email: "bautistarava45@gmail.com", name: "Bautista Rava" },
  { email: "joaquingale97@gmail.com", name: "Joaquin Gale" },
  { email: "franschenone7@gmail.com", name: "Fran Schenone" },
  { email: "alzogaraydiego@gmail.com", name: "Diego Alzogaray" },
  { email: "amedinar89@gmail.com", name: "Alex Medina" },
];

const PASSWORD = "LiceoScrum1950!";

async function createAdmin({ email, name }) {
  // 1. Create auth user
  const { data: authData, error: authError } =
    await supabase.auth.admin.createUser({
      email,
      password: PASSWORD,
      email_confirm: true,
      user_metadata: { full_name: name, role: "admin" },
    });

  if (authError) {
    if (authError.message?.includes("already been registered")) {
      // User exists in auth — try to update their profile to admin
      const { data: existingUsers } = await supabase.auth.admin.listUsers();
      const existing = existingUsers?.users?.find(
        (u) => u.email === email.toLowerCase()
      );
      if (existing) {
        // Update password
        await supabase.auth.admin.updateUserById(existing.id, {
          password: PASSWORD,
        });
        // Upsert profile as admin
        const sellerCode = "ADM-" + existing.id.substring(0, 6).toUpperCase();
        const { error: profileError } = await supabase.from("profiles").upsert({
          id: existing.id,
          role: "admin",
          full_name: name,
          email: email.toLowerCase(),
          seller_code: sellerCode,
          is_active: true,
          must_change_password: false,
        });
        if (profileError) {
          console.error(`  PROFILE ERROR for ${email}:`, profileError.message);
          return false;
        }
        console.log(`  UPDATED existing user → admin: ${email} (${sellerCode})`);
        return true;
      }
      console.error(`  EXISTS but could not find: ${email}`);
      return false;
    }
    console.error(`  AUTH ERROR for ${email}:`, authError.message);
    return false;
  }

  if (!authData.user) {
    console.error(`  NO USER returned for ${email}`);
    return false;
  }

  // 2. Create profile
  const sellerCode = "ADM-" + authData.user.id.substring(0, 6).toUpperCase();
  const { error: profileError } = await supabase.from("profiles").upsert({
    id: authData.user.id,
    role: "admin",
    full_name: name,
    email: email.toLowerCase(),
    seller_code: sellerCode,
    is_active: true,
    must_change_password: false,
  });

  if (profileError) {
    console.error(`  PROFILE ERROR for ${email}:`, profileError.message);
    // Clean up auth user
    await supabase.auth.admin.deleteUser(authData.user.id);
    return false;
  }

  console.log(`  CREATED: ${email} (${sellerCode})`);
  return true;
}

async function main() {
  console.log("Creating admin accounts...\n");
  console.log(`Password for all: ${PASSWORD}\n`);

  let success = 0;
  let failed = 0;

  for (const admin of ADMINS) {
    process.stdout.write(`${admin.email}... `);
    const ok = await createAdmin(admin);
    if (ok) success++;
    else failed++;
  }

  console.log(`\nDone: ${success} created, ${failed} failed`);
}

main().catch(console.error);
