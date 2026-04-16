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
