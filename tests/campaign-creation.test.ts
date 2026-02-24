import { describe, it, expect, afterAll } from "vitest";
import { createClient } from "@supabase/supabase-js";

// These tests require environment variables to be set
// Run with: npx vitest run --env-file=.env
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

const skipIfNoEnv = !supabaseUrl || !serviceRoleKey;

// Track campaign IDs for cleanup
const createdCampaignIds: string[] = [];

const serviceClient = skipIfNoEnv
  ? null
  : createClient(supabaseUrl, serviceRoleKey);

async function cleanupCampaigns() {
  if (!serviceClient) return;
  for (const id of createdCampaignIds) {
    // Delete tickets first (FK constraint)
    await serviceClient.from("tickets").delete().eq("campaign_id", id);
    // Delete campaign_sellers
    await serviceClient
      .from("campaign_sellers")
      .delete()
      .eq("campaign_id", id);
    // Delete campaign
    await serviceClient.from("campaigns").delete().eq("id", id);
  }
}

afterAll(async () => {
  await cleanupCampaigns();
});

describe.skipIf(skipIfNoEnv)("Campaign creation (integration)", () => {
  it("creates a campaign with service role client", async () => {
    const { data, error } = await serviceClient!
      .from("campaigns")
      .insert({
        name: "Test Campaign Service",
        slug: "test-svc-" + Date.now(),
        start_date: new Date().toISOString(),
        end_date: new Date(Date.now() + 86400000 * 30).toISOString(),
        ticket_price: 100,
        number_from: 0,
        number_to: 10,
        max_tickets_per_buyer: 1,
        status: "draft",
        installments_enabled: false,
        installments_count: 1,
      })
      .select()
      .single();

    expect(error).toBeNull();
    expect(data).toBeDefined();
    expect(data!.name).toBe("Test Campaign Service");
    createdCampaignIds.push(data!.id);
  });

  it("auto-generates tickets on campaign creation", async () => {
    const slug = "test-tickets-" + Date.now();
    const { data: campaign, error: insertError } = await serviceClient!
      .from("campaigns")
      .insert({
        name: "Ticket Gen Test",
        slug,
        start_date: new Date().toISOString(),
        end_date: new Date(Date.now() + 86400000 * 30).toISOString(),
        ticket_price: 50,
        number_from: 0,
        number_to: 5,
        max_tickets_per_buyer: 1,
        status: "draft",
        installments_enabled: false,
        installments_count: 1,
      })
      .select()
      .single();

    expect(insertError).toBeNull();
    expect(campaign).toBeDefined();
    createdCampaignIds.push(campaign!.id);

    // Check tickets were generated
    const { data: tickets, error: ticketsError } = await serviceClient!
      .from("tickets")
      .select("number, status")
      .eq("campaign_id", campaign!.id)
      .order("number");

    expect(ticketsError).toBeNull();
    expect(tickets).toHaveLength(6); // 0 to 5 inclusive
    expect(tickets![0].number).toBe("00000");
    expect(tickets![5].number).toBe("00005");
    expect(tickets!.every((t) => t.status === "available")).toBe(true);
  });

  it("creates a campaign as authenticated admin (RLS)", async () => {
    const anonClient = createClient(supabaseUrl, anonKey);

    // Sign in as admin
    const { data: authData, error: authError } =
      await anonClient.auth.signInWithPassword({
        email: "amedinar89@gmail.com",
        password: "LiceoScrum1950!",
      });

    expect(authError).toBeNull();
    expect(authData.user).toBeDefined();

    const slug = "test-rls-" + Date.now();
    const { data, error } = await anonClient
      .from("campaigns")
      .insert({
        name: "RLS Test Campaign",
        slug,
        start_date: new Date().toISOString(),
        end_date: new Date(Date.now() + 86400000 * 30).toISOString(),
        ticket_price: 200,
        number_from: 0,
        number_to: 5,
        max_tickets_per_buyer: 1,
        status: "draft",
        installments_enabled: false,
        installments_count: 1,
        created_by: authData.user!.id,
      })
      .select()
      .single();

    expect(error).toBeNull();
    expect(data).toBeDefined();
    createdCampaignIds.push(data!.id);
  });

  it("rejects duplicate slug", async () => {
    const slug = "test-dup-" + Date.now();

    // First insert
    const { data: first, error: firstError } = await serviceClient!
      .from("campaigns")
      .insert({
        name: "First Campaign",
        slug,
        start_date: new Date().toISOString(),
        end_date: new Date(Date.now() + 86400000 * 30).toISOString(),
        ticket_price: 100,
        number_from: 0,
        number_to: 5,
        max_tickets_per_buyer: 1,
        status: "draft",
        installments_enabled: false,
        installments_count: 1,
      })
      .select()
      .single();

    expect(firstError).toBeNull();
    createdCampaignIds.push(first!.id);

    // Second insert with same slug
    const { error: dupError } = await serviceClient!
      .from("campaigns")
      .insert({
        name: "Duplicate Campaign",
        slug,
        start_date: new Date().toISOString(),
        end_date: new Date(Date.now() + 86400000 * 30).toISOString(),
        ticket_price: 100,
        number_from: 0,
        number_to: 5,
        max_tickets_per_buyer: 1,
        status: "draft",
        installments_enabled: false,
        installments_count: 1,
      })
      .select()
      .single();

    expect(dupError).not.toBeNull();
    expect(dupError!.code).toBe("23505"); // unique_violation
  });

  it("auto-assigns admins to new campaign", async () => {
    const slug = "test-auto-assign-" + Date.now();
    const { data: campaign, error } = await serviceClient!
      .from("campaigns")
      .insert({
        name: "Auto Assign Test",
        slug,
        start_date: new Date().toISOString(),
        end_date: new Date(Date.now() + 86400000 * 30).toISOString(),
        ticket_price: 100,
        number_from: 0,
        number_to: 5,
        max_tickets_per_buyer: 1,
        status: "draft",
        installments_enabled: false,
        installments_count: 1,
      })
      .select()
      .single();

    expect(error).toBeNull();
    createdCampaignIds.push(campaign!.id);

    // Check admins were auto-assigned
    const { data: admins } = await serviceClient!
      .from("profiles")
      .select("id")
      .eq("role", "admin")
      .eq("is_active", true);

    const { data: assignments } = await serviceClient!
      .from("campaign_sellers")
      .select("seller_id")
      .eq("campaign_id", campaign!.id);

    const adminIds = new Set(admins?.map((a) => a.id) || []);
    const assignedIds = new Set(assignments?.map((a) => a.seller_id) || []);

    // Every active admin should be assigned
    for (const adminId of adminIds) {
      expect(assignedIds.has(adminId)).toBe(true);
    }
  });

  it("handles large number range (performance)", async () => {
    const slug = "test-large-" + Date.now();
    const start = Date.now();

    const { data, error } = await serviceClient!
      .from("campaigns")
      .insert({
        name: "Large Range Test",
        slug,
        start_date: new Date().toISOString(),
        end_date: new Date(Date.now() + 86400000 * 30).toISOString(),
        ticket_price: 100,
        number_from: 0,
        number_to: 9999,
        max_tickets_per_buyer: 1,
        status: "draft",
        installments_enabled: false,
        installments_count: 1,
      })
      .select()
      .single();

    const elapsed = Date.now() - start;

    expect(error).toBeNull();
    expect(data).toBeDefined();
    createdCampaignIds.push(data!.id);

    // Verify correct count
    const { count } = await serviceClient!
      .from("tickets")
      .select("*", { count: "exact", head: true })
      .eq("campaign_id", data!.id);

    expect(count).toBe(10000);

    // Should complete within 10 seconds (Vercel free tier limit)
    console.log(`Large range (10000 tickets) created in ${elapsed}ms`);
    expect(elapsed).toBeLessThan(10000);
  }, 30000); // 30s test timeout
});
