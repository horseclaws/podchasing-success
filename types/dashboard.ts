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
  status: 'draft' | 'sent' | 'accepted';
  amount: number | null;
  percentChange: number | null;
}

export interface DealWithQuote extends DealWithContacts {
  quote: DealQuote | null;
  daysUntilRenewal: number;
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
}
