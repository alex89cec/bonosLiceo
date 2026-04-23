// Auto-generated types placeholder.
// Run `npm run supabase:gen-types` after migrations to generate actual types.
// Below are manual types matching the schema for development.

export type UserRole = "admin" | "seller";
export type CampaignStatus = "draft" | "active" | "sorted" | "closed";
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
  group_id: string | null;
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
  flyer_url: string | null;
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

export interface CampaignSeller {
  id: string;
  campaign_id: string;
  seller_id: string;
  max_tickets: number | null;
  assigned_at: string;
}

export interface SellerGroup {
  id: string;
  name: string;
  admin_id: string;
  color: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface CampaignGroup {
  id: string;
  campaign_id: string;
  group_id: string;
  assigned_at: string;
}

export interface Winner {
  id: string;
  campaign_id: string;
  ticket_id: string;
  ticket_number: string;
  buyer_name: string | null;
  buyer_email: string;
  position: number;
  drawn_at: string;
  drawn_by: string;
}

// ============================================================
// EVENTS & TICKETS (separate module from raffle bonos)
// ============================================================

export type EventStatus = "draft" | "active" | "past" | "cancelled";
export type EventTicketStatus = "valid" | "used" | "cancelled" | "refunded";
export type ScanResult =
  | "valid"
  | "already_used"
  | "invalid"
  | "wrong_event"
  | "cancelled";
export type PendingOrderStatus =
  | "pending"
  | "approved"
  | "failed"
  | "expired"
  | "cancelled";

export interface Event {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  event_date: string;
  venue: string | null;
  image_url: string | null;
  status: EventStatus;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface EventTicketType {
  id: string;
  event_id: string;
  name: string;
  description: string | null;
  price: number;
  quantity: number;
  color: string;
  sales_start_at: string | null;
  sales_end_at: string | null;
  is_complimentary: boolean;
  display_order: number;
  created_at: string;
  updated_at: string;
}

export interface EventTicket {
  id: string;
  event_id: string;
  ticket_type_id: string;
  buyer_id: string;
  seller_id: string | null;
  payment_id: string | null;
  qr_token: string;
  status: EventTicketStatus;
  entered_at: string | null;
  entered_by: string | null;
  is_complimentary: boolean;
  created_at: string;
  updated_at: string;
}

export interface EventSeller {
  id: string;
  event_id: string;
  seller_id: string;
  can_sell: boolean;
  can_scan: boolean;
  assigned_at: string;
}

export interface EventScanLog {
  id: string;
  event_ticket_id: string | null;
  event_id: string | null;
  scanned_by: string | null;
  scanned_at: string;
  result: ScanResult;
  metadata: Record<string, unknown> | null;
}

export interface PendingOrder {
  id: string;
  event_id: string;
  buyer_email: string;
  buyer_name: string | null;
  buyer_phone: string | null;
  items: { ticket_type_id: string; quantity: number; price: number }[];
  total: number;
  mp_preference_id: string | null;
  mp_payment_id: string | null;
  seller_code: string | null;
  status: PendingOrderStatus;
  expires_at: string;
  approved_at: string | null;
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
