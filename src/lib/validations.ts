import { z } from "zod";

export const ticketNumberSchema = z
  .string()
  .regex(/^[0-9]{5}$/, "Must be exactly 5 digits");

export const emailSchema = z
  .string()
  .email("Invalid email")
  .transform((v) => v.toLowerCase().trim());

export const reserveTicketSchema = z.object({
  campaign_slug: z.string().min(1),
  seller_code: z.string().min(1),
  buyer_email: emailSchema,
  ticket_number: ticketNumberSchema,
  payment_mode: z.enum(["full_payment", "installments"]).optional(),
  buyer_name: z.string().optional(),
  buyer_phone: z.string().optional(),
});

export const campaignSchema = z
  .object({
    name: z.string().min(1).max(200),
    slug: z
      .string()
      .min(1)
      .max(100)
      .regex(/^[a-z0-9-]+$/),
    description: z.string().optional(),
    start_date: z.string().datetime(),
    end_date: z.string().datetime(),
    ticket_price: z.number().positive(),
    number_from: z.number().int().min(0).max(99999),
    number_to: z.number().int().min(1).max(99999),
    installments_enabled: z.boolean().default(false),
    installments_count: z.number().int().min(1).default(1),
    max_tickets_per_buyer: z.number().int().min(1).default(1),
  })
  .refine((data) => data.number_to > data.number_from, {
    message: "El rango final debe ser mayor al rango inicial",
    path: ["number_to"],
  })
  .refine((data) => new Date(data.end_date) > new Date(data.start_date), {
    message: "La fecha de fin debe ser posterior a la fecha de inicio",
    path: ["end_date"],
  });

export const reserveBatchSchema = z.object({
  campaign_slug: z.string().min(1),
  seller_code: z.string().min(1),
  buyer_email: emailSchema,
  ticket_numbers: z.array(ticketNumberSchema).min(1).max(50),
  payment_mode: z.enum(["full_payment", "installments"]).optional(),
  buyer_name: z.string().optional(),
  buyer_phone: z.string().optional(),
});

export const sorteoSchema = z.discriminatedUnion("mode", [
  z.object({
    mode: z.literal("random"),
    count: z.number().int().min(1).max(100),
  }),
  z.object({
    mode: z.literal("manual"),
    ticket_number: ticketNumberSchema,
  }),
]);

export const groupSchema = z.object({
  name: z.string().min(1).max(200),
  admin_id: z.string().uuid(),
  color: z.string().min(1).max(20).optional().default("blue"),
});

// ============================================================
// Events (tickets module)
// ============================================================

export const eventSchema = z.object({
  name: z.string().min(1).max(200),
  slug: z
    .string()
    .min(1)
    .max(100)
    .regex(/^[a-z0-9-]+$/, "Solo letras, números y guiones"),
  description: z.string().optional().nullable(),
  event_date: z.string().datetime(),
  venue: z.string().optional().nullable(),
  image_url: z.string().url().optional().nullable(),
  status: z.enum(["draft", "active", "past", "cancelled"]).default("draft"),
  // Transfer data
  transfer_holder_name: z.string().max(200).optional().nullable(),
  transfer_cbu: z.string().max(40).optional().nullable(),
  transfer_alias: z.string().max(60).optional().nullable(),
  transfer_bank: z.string().max(100).optional().nullable(),
  transfer_id_number: z.string().max(40).optional().nullable(),
  transfer_instructions: z.string().max(1000).optional().nullable(),
});

// Base object schema (ZodObject — supports .partial() for PATCH/PUT)
export const eventTicketTypeBaseSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().optional().nullable(),
  price: z.number().min(0),
  /** null o ausente = sin cupo (ilimitado) */
  quantity: z.number().int().positive().nullable().optional(),
  color: z.string().min(1).max(20).default("gray"),
  sales_start_at: z.string().datetime().optional().nullable(),
  sales_end_at: z.string().datetime().optional().nullable(),
  is_complimentary: z.boolean().default(false),
  display_order: z.number().int().default(0),
});

// Full schema with cross-field validation, used for creates
export const eventTicketTypeSchema = eventTicketTypeBaseSchema.refine(
  (data) => {
    if (data.sales_start_at && data.sales_end_at) {
      return new Date(data.sales_end_at) > new Date(data.sales_start_at);
    }
    return true;
  },
  {
    message: "La fecha de fin de ventas debe ser posterior al inicio",
    path: ["sales_end_at"],
  },
);

export const eventSellerAssignmentSchema = z.object({
  seller_id: z.string().uuid(),
  can_sell: z.boolean().default(true),
  can_scan: z.boolean().default(false),
});

export type ReserveTicketInput = z.infer<typeof reserveTicketSchema>;
export type ReserveBatchInput = z.infer<typeof reserveBatchSchema>;
export type CampaignInput = z.infer<typeof campaignSchema>;
export type SorteoInput = z.infer<typeof sorteoSchema>;
export type GroupInput = z.infer<typeof groupSchema>;
export type EventInput = z.infer<typeof eventSchema>;
export type EventTicketTypeInput = z.infer<typeof eventTicketTypeSchema>;
export type EventSellerAssignmentInput = z.infer<typeof eventSellerAssignmentSchema>;
