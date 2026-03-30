// types/dashboard.ts
export type LoginTier = 'Active' | 'Inactive' | 'Ghost';

export interface DashboardContact {
  id: string;
  name: string;
  email: string;
  title: string | null;
  lastLoginDate: string | null;
  tier: LoginTier;
  hubspotUrl: string;
}

export interface DashboardDeal {
  id: string;
  name: string;
  stage: string;
  amount: number | null;
  contractEndDate: string | null;
  lastContactedDate: string | null;
  businessType: string | null;
  ownerId: string | null;
  ownerName: string;
  seats: number;
}

export interface DealWithContacts extends DashboardDeal {
  contacts: DashboardContact[];
}

export interface DealQuote {
  status: 'draft' | 'sent' | 'accepted' | 'expired';
  amount: number | null;
  percentChange: number | null;
}

export interface DealWithQuote extends DealWithContacts {
  quote: DealQuote | null;
  daysUntilRenewal: number;
}

export interface RenewalPipelineBucket {
  count: number;
  amount: number;
}

export interface TopAccount {
  id: string;
  name: string;
  amount: number;
  contractEndDate: string | null;
  stage: string;
}

export interface SummaryData {
  totalDeals: number;
  totalContractValue: number;
  totalSeats: number;
  activeContacts: number;
  inactiveContacts: number;
  ghostContacts: number;
  byStage: Record<string, number>;
  byBusinessType: Record<string, number>;
  // New insight fields
  seatUtilizationPct: number;
  renewalPipeline: { d30: RenewalPipelineBucket; d60: RenewalPipelineBucket; d90: RenewalPipelineBucket };
  quoteCoverage: { withQuote: number; total: number };
  renewalsByMonth: Array<{ label: string; count: number; amount: number }>;
  topAccounts: TopAccount[];
}
