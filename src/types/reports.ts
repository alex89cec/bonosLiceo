export interface CampaignReport {
  id: string;
  name: string;
  status: string;
  ticket_price: number;
  total_numbers: number;
  available: number;
  reserved: number;
  sold: number;
  percent_sold: number;
  expected_amount: number;
  confirmed_amount: number;
  partial_amount: number;
  pending_amount: number;
  overdue_installments: number;
  overdue_amount: number;
  sellers: CampaignSellerBreakdown[];
}

export interface CampaignSellerBreakdown {
  id: string;
  name: string;
  code: string | null;
  reserved: number;
  sold: number;
  confirmed_amount: number;
  pending_amount: number;
}

export interface SellerReport {
  id: string;
  name: string;
  code: string | null;
  email: string;
  role: string;
  group_name: string | null;
  group_color: string | null;
  campaigns_assigned: number;
  total_reserved: number;
  total_sold: number;
  expected_amount: number;
  confirmed_amount: number;
  pending_amount: number;
  campaigns: SellerCampaignBreakdown[];
}

export interface SellerCampaignBreakdown {
  id: string;
  name: string;
  status: string;
  reserved: number;
  sold: number;
  confirmed_amount: number;
  pending_amount: number;
}

export interface GroupReport {
  id: string;
  name: string;
  color: string;
  admin_name: string;
  member_count: number;
  campaigns_assigned: number;
  total_sold: number;
  total_expected: number;
  confirmed_amount: number;
  pending_amount: number;
  members: GroupMemberBreakdown[];
}

export interface GroupMemberBreakdown {
  id: string;
  name: string;
  code: string | null;
  sold: number;
  confirmed_amount: number;
  pending_amount: number;
}

export interface SummaryReport {
  total_expected: number;
  total_confirmed: number;
  total_pending: number;
  total_numbers: number;
  total_sold: number;
  total_reserved: number;
  overdue_count: number;
  overdue_amount: number;
  campaigns: SummaryCampaign[];
}

export interface SummaryCampaignReservation {
  ticket_number: string;
  seller_name: string;
  seller_code: string | null;
  buyer_email: string;
  buyer_name: string | null;
  status: string; // "active" = reserved, "confirmed" = sold
  payment_status: string;
}

export interface SummaryCampaign {
  id: string;
  name: string;
  status: string;
  total: number;
  sold: number;
  reserved: number;
  percent: number;
  reservations: SummaryCampaignReservation[];
}

// ============================================================
// Bonos detail (per-reservation report)
// ============================================================
export interface BonosDetailRow {
  id: string; // reservation id
  ticket_number: string;
  campaign_id: string;
  campaign_name: string;
  campaign_status: string;
  seller_id: string | null;
  seller_name: string | null;
  seller_code: string | null;
  buyer_id: string;
  buyer_email: string;
  buyer_name: string | null;
  status: "active" | "confirmed" | "cancelled";
  payment_status: "pending" | "partial" | "completed" | null;
  amount: number;
  created_at: string;
}

// ============================================================
// Events reports
// ============================================================
export interface EventsSummary {
  total_events: number;
  active_events: number;
  total_orders: number;
  approved_orders: number;
  pending_orders: number; // pending_review + awaiting_receipt
  rejected_orders: number;
  complimentary_orders: number;
  total_tickets_issued: number;
  total_amount_collected: number;
  total_amount_pending: number;
}

export interface EventReportTypeBreakdown {
  id: string;
  name: string;
  color: string;
  quantity: number | null; // null = unlimited
  sold: number;
  pending: number;
  is_bundle: boolean;
}

export interface EventReportRow {
  id: string;
  name: string;
  slug: string;
  status: string;
  event_date: string;
  venue: string | null;
  total_orders: number;
  approved_orders: number;
  pending_orders: number;
  rejected_orders: number;
  tickets_issued: number;
  total_amount_collected: number;
  total_amount_pending: number;
  types: EventReportTypeBreakdown[];
}

export interface EventOrderItem {
  ticket_type_id: string;
  name: string;
  quantity: number;
  unit_price: number;
  is_bundle?: boolean;
}

export interface EventOrderRow {
  id: string;
  event_id: string;
  event_name: string;
  buyer_id: string;
  buyer_email: string;
  buyer_name: string | null;
  seller_id: string | null;
  seller_name: string | null;
  seller_code: string | null;
  items: EventOrderItem[];
  total_amount: number;
  payment_method: string;
  receipt_filename: string | null;
  status: string; // pending_review/awaiting_receipt/approved/rejected/complimentary/cancelled
  rejection_reason: string | null;
  created_at: string;
  reviewed_at: string | null;
}

export interface EventsSellerEventBreakdown {
  event_id: string;
  event_name: string;
  approved_orders: number;
  pending_orders: number;
  amount_collected: number;
}

export interface EventsSellerReport {
  id: string;
  name: string;
  email: string;
  code: string | null;
  total_orders: number;
  approved_orders: number;
  pending_orders: number;
  total_amount_collected: number;
  events: EventsSellerEventBreakdown[];
}
