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

async function main() {
  // 1. Get all admins
  const { data: admins, error: adminsError } = await supabase
    .from("profiles")
    .select("id, full_name, email")
    .eq("role", "admin");

  if (adminsError) {
    console.error("Error fetching admins:", adminsError.message);
    process.exit(1);
  }

  console.log(`Found ${admins.length} admins\n`);

  // 2. Get all campaigns
  const { data: campaigns, error: campaignsError } = await supabase
    .from("campaigns")
    .select("id, name, status");

  if (campaignsError) {
    console.error("Error fetching campaigns:", campaignsError.message);
    process.exit(1);
  }

  console.log(`Found ${campaigns.length} campaigns\n`);

  if (campaigns.length === 0) {
    console.log("No campaigns to assign. Done.");
    return;
  }

  // 3. Create assignments
  let created = 0;
  let skipped = 0;

  for (const admin of admins) {
    for (const campaign of campaigns) {
      const { error } = await supabase
        .from("campaign_sellers")
        .upsert(
          { campaign_id: campaign.id, seller_id: admin.id },
          { onConflict: "campaign_id,seller_id" }
        );

      if (error) {
        console.error(`  ERROR: ${admin.email} → ${campaign.name}: ${error.message}`);
      } else {
        created++;
      }
    }
    console.log(`  ${admin.email} → assigned to ${campaigns.length} campaigns`);
  }

  console.log(`\nDone: ${created} assignments created/confirmed`);
}

main().catch(console.error);
