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

export type ReserveTicketInput = z.infer<typeof reserveTicketSchema>;
export type ReserveBatchInput = z.infer<typeof reserveBatchSchema>;
export type CampaignInput = z.infer<typeof campaignSchema>;
export type SorteoInput = z.infer<typeof sorteoSchema>;
