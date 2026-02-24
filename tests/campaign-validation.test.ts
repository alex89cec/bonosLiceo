import { describe, it, expect } from "vitest";
import { campaignSchema } from "@/lib/validations";

describe("campaignSchema", () => {
  const validCampaign = {
    name: "Bono Navideño 2025",
    slug: "bono-navideno-2025",
    start_date: "2026-01-01T00:00:00.000Z",
    end_date: "2026-02-01T00:00:00.000Z",
    ticket_price: 1000,
    number_from: 0,
    number_to: 9999,
    max_tickets_per_buyer: 1,
    installments_enabled: false,
    installments_count: 1,
  };

  it("accepts a valid campaign", () => {
    const result = campaignSchema.safeParse(validCampaign);
    expect(result.success).toBe(true);
  });

  // --- Name ---
  it("rejects empty name", () => {
    const result = campaignSchema.safeParse({ ...validCampaign, name: "" });
    expect(result.success).toBe(false);
  });

  it("rejects name longer than 200 chars", () => {
    const result = campaignSchema.safeParse({
      ...validCampaign,
      name: "a".repeat(201),
    });
    expect(result.success).toBe(false);
  });

  // --- Slug ---
  it("rejects empty slug", () => {
    const result = campaignSchema.safeParse({ ...validCampaign, slug: "" });
    expect(result.success).toBe(false);
  });

  it("rejects slug with uppercase letters", () => {
    const result = campaignSchema.safeParse({
      ...validCampaign,
      slug: "Bono-2025",
    });
    expect(result.success).toBe(false);
  });

  it("rejects slug with special characters", () => {
    const result = campaignSchema.safeParse({
      ...validCampaign,
      slug: "bono_2025!",
    });
    expect(result.success).toBe(false);
  });

  it("accepts slug with hyphens and numbers", () => {
    const result = campaignSchema.safeParse({
      ...validCampaign,
      slug: "bono-navideno-2025",
    });
    expect(result.success).toBe(true);
  });

  // --- Dates ---
  it("rejects non-ISO date strings", () => {
    const result = campaignSchema.safeParse({
      ...validCampaign,
      start_date: "2026-01-01",
    });
    expect(result.success).toBe(false);
  });

  it("rejects end_date equal to start_date", () => {
    const result = campaignSchema.safeParse({
      ...validCampaign,
      start_date: "2026-01-01T00:00:00.000Z",
      end_date: "2026-01-01T00:00:00.000Z",
    });
    expect(result.success).toBe(false);
  });

  it("rejects end_date before start_date", () => {
    const result = campaignSchema.safeParse({
      ...validCampaign,
      start_date: "2026-02-01T00:00:00.000Z",
      end_date: "2026-01-01T00:00:00.000Z",
    });
    expect(result.success).toBe(false);
  });

  it("accepts ISO datetime string with timezone from toISOString()", () => {
    const start = new Date("2026-03-01T10:00").toISOString();
    const end = new Date("2026-04-01T10:00").toISOString();
    const result = campaignSchema.safeParse({
      ...validCampaign,
      start_date: start,
      end_date: end,
    });
    expect(result.success).toBe(true);
  });

  // --- Ticket price ---
  it("rejects zero ticket_price", () => {
    const result = campaignSchema.safeParse({
      ...validCampaign,
      ticket_price: 0,
    });
    expect(result.success).toBe(false);
  });

  it("rejects negative ticket_price", () => {
    const result = campaignSchema.safeParse({
      ...validCampaign,
      ticket_price: -100,
    });
    expect(result.success).toBe(false);
  });

  it("accepts decimal ticket_price", () => {
    const result = campaignSchema.safeParse({
      ...validCampaign,
      ticket_price: 999.99,
    });
    expect(result.success).toBe(true);
  });

  // --- Number range ---
  it("rejects number_from greater than number_to", () => {
    const result = campaignSchema.safeParse({
      ...validCampaign,
      number_from: 100,
      number_to: 50,
    });
    expect(result.success).toBe(false);
  });

  it("rejects number_from equal to number_to", () => {
    const result = campaignSchema.safeParse({
      ...validCampaign,
      number_from: 100,
      number_to: 100,
    });
    // Refine checks number_to > number_from, so equal is rejected
    expect(result.success).toBe(false);
  });

  it("rejects number_from less than 0", () => {
    const result = campaignSchema.safeParse({
      ...validCampaign,
      number_from: -1,
    });
    expect(result.success).toBe(false);
  });

  it("rejects number_to greater than 99999", () => {
    const result = campaignSchema.safeParse({
      ...validCampaign,
      number_to: 100000,
    });
    expect(result.success).toBe(false);
  });

  it("accepts minimum valid range (0 to 1)", () => {
    const result = campaignSchema.safeParse({
      ...validCampaign,
      number_from: 0,
      number_to: 1,
    });
    expect(result.success).toBe(true);
  });

  it("accepts maximum valid range (0 to 99999)", () => {
    const result = campaignSchema.safeParse({
      ...validCampaign,
      number_from: 0,
      number_to: 99999,
    });
    expect(result.success).toBe(true);
  });

  it("accepts range of exactly 100,000 tickets (0 to 99999) and validates size", () => {
    const result = campaignSchema.safeParse({
      ...validCampaign,
      number_from: 0,
      number_to: 99999,
    });
    expect(result.success).toBe(true);
    if (result.success) {
      const rangeSize = result.data.number_to - result.data.number_from + 1;
      expect(rangeSize).toBe(100000);
    }
  });

  it("rejects number_to of 0", () => {
    const result = campaignSchema.safeParse({
      ...validCampaign,
      number_from: 0,
      number_to: 0,
    });
    expect(result.success).toBe(false);
  });

  // --- Max tickets per buyer ---
  it("rejects zero max_tickets_per_buyer", () => {
    const result = campaignSchema.safeParse({
      ...validCampaign,
      max_tickets_per_buyer: 0,
    });
    expect(result.success).toBe(false);
  });

  it("defaults max_tickets_per_buyer to 1 when not provided", () => {
    const { max_tickets_per_buyer, ...rest } = validCampaign;
    void max_tickets_per_buyer;
    const result = campaignSchema.safeParse(rest);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.max_tickets_per_buyer).toBe(1);
    }
  });

  // --- Installments ---
  it("accepts installments_enabled with count", () => {
    const result = campaignSchema.safeParse({
      ...validCampaign,
      installments_enabled: true,
      installments_count: 3,
    });
    expect(result.success).toBe(true);
  });

  it("defaults installments_enabled to false", () => {
    const { installments_enabled, ...rest } = validCampaign;
    void installments_enabled;
    const result = campaignSchema.safeParse(rest);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.installments_enabled).toBe(false);
    }
  });

  it("defaults installments_count to 1", () => {
    const { installments_count, ...rest } = validCampaign;
    void installments_count;
    const result = campaignSchema.safeParse(rest);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.installments_count).toBe(1);
    }
  });

  // --- Description ---
  it("accepts optional description", () => {
    const result = campaignSchema.safeParse({
      ...validCampaign,
      description: "Una gran campaña de bonos",
    });
    expect(result.success).toBe(true);
  });

  it("accepts missing description", () => {
    const { description, ...rest } = validCampaign;
    void description;
    const result = campaignSchema.safeParse(rest);
    expect(result.success).toBe(true);
  });

  // --- Missing required fields ---
  it("rejects missing name", () => {
    const { name, ...rest } = validCampaign;
    void name;
    const result = campaignSchema.safeParse(rest);
    expect(result.success).toBe(false);
  });

  it("rejects missing slug", () => {
    const { slug, ...rest } = validCampaign;
    void slug;
    const result = campaignSchema.safeParse(rest);
    expect(result.success).toBe(false);
  });

  it("rejects missing start_date", () => {
    const { start_date, ...rest } = validCampaign;
    void start_date;
    const result = campaignSchema.safeParse(rest);
    expect(result.success).toBe(false);
  });

  it("rejects missing end_date", () => {
    const { end_date, ...rest } = validCampaign;
    void end_date;
    const result = campaignSchema.safeParse(rest);
    expect(result.success).toBe(false);
  });

  it("rejects missing ticket_price", () => {
    const { ticket_price, ...rest } = validCampaign;
    void ticket_price;
    const result = campaignSchema.safeParse(rest);
    expect(result.success).toBe(false);
  });

  it("rejects non-numeric ticket_price", () => {
    const result = campaignSchema.safeParse({
      ...validCampaign,
      ticket_price: "abc",
    });
    expect(result.success).toBe(false);
  });

  // --- Form simulation tests ---
  it("handles typical form submission payload", () => {
    // Simulates what the new campaign form sends
    const startDate = "2026-03-01T10:00"; // datetime-local value
    const endDate = "2026-04-01T10:00";

    const payload = {
      name: "Bono Contribución Test",
      slug: "bono-contribucion-test",
      description: undefined,
      start_date: new Date(startDate).toISOString(),
      end_date: new Date(endDate).toISOString(),
      ticket_price: 1000,
      number_from: 0,
      number_to: 9999,
      max_tickets_per_buyer: 1,
      installments_enabled: false,
      installments_count: 1,
    };

    const result = campaignSchema.safeParse(payload);
    expect(result.success).toBe(true);
  });

  it("handles form payload with installments enabled", () => {
    const payload = {
      name: "Bono con cuotas",
      slug: "bono-cuotas",
      start_date: new Date("2026-03-01T10:00").toISOString(),
      end_date: new Date("2026-04-01T10:00").toISOString(),
      ticket_price: 5000,
      number_from: 0,
      number_to: 999,
      max_tickets_per_buyer: 3,
      installments_enabled: true,
      installments_count: 6,
    };

    const result = campaignSchema.safeParse(payload);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.installments_enabled).toBe(true);
      expect(result.data.installments_count).toBe(6);
    }
  });
});
