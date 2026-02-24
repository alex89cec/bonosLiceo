// Auto-generated types placeholder.
// Run `npm run supabase:gen-types` after migrations to generate actual types.
// Below are manual types matching the schema for development.

export type UserRole = "admin" | "seller";
export type CampaignStatus = "draft" | "active" | "closed";
export type TicketStatus = "available" | "reserved" | "sold";
export type ReservationStatus = "active" | "confirmed" | "cancelled";
export type PaymentMode = "full_payment" | "installments";
export type PaymentStatus = "pending" | "partial" | "completed";
export type InstallmentStatus = "pending" | "paid" | "overdue";

export interface Profile {
  id: string;
  role: UserRole;
  full_name: string;
  email: string;
  phone: string | null;
  seller_code: string | null;
  is_active: boolean;
  must_change_password: boolean;
  created_at: string;
  updated_at: string;
}

export interface Campaign {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  start_date: string;
  end_date: string;
  status: CampaignStatus;
  ticket_price: number;
  number_from: number;
  number_to: number;
  installments_enabled: boolean;
  installments_count: number;
  max_tickets_per_buyer: number;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface Ticket {
  id: string;
  campaign_id: string;
  seller_id: string | null;
  number: string;
  status: TicketStatus;
  created_at: string;
  updated_at: string;
}

export interface Buyer {
  id: string;
  email: string;
  full_name: string | null;
  phone: string | null;
  created_at: string;
  updated_at: string;
}

export interface Reservation {
  id: string;
  ticket_id: string;
  buyer_id: string;
  campaign_id: string;
  seller_id: string;
  status: ReservationStatus;
  expires_at: string | null;
  confirmed_at: string | null;
  created_at: string;
}

export interface Payment {
  id: string;
  reservation_id: string;
  buyer_id: string;
  campaign_id: string;
  amount: number;
  payment_mode: PaymentMode;
  status: PaymentStatus;
  created_at: string;
  updated_at: string;
}

export interface Installment {
  id: string;
  payment_id: string;
  number: number;
  amount: number;
  due_date: string;
  paid_at: string | null;
  status: InstallmentStatus;
  created_at: string;
  updated_at: string;
}

// RPC response types
export interface ReserveTicketResponse {
  success: boolean;
  reservation_id: string;
  ticket_number: string;
  campaign_name: string;
  ticket_price: number;
  payment_mode: PaymentMode;
  installments_count: number;
  buyer_email: string;
  seller_name: string;
}

export interface TicketInfo {
  number: string;
  status: TicketStatus;
}

export interface AvailableTicketsResponse {
  success: boolean;
  campaign_slug: string;
  tickets: TicketInfo[];
  total: number;
  available: number;
}
