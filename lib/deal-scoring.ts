// lib/deal-scoring.ts

export interface RawDealResult {
  id: string;
  name: string;
  stage: string;           // human-readable label (already mapped by API)
  pipeline: string;
  amount: number | null;
  contractEndDate: string | null;    // ISO date string e.g. "2026-04-01"
  lastContactedDate: string | null;  // ISO date string
  businessType: string | null;
  company: { id: string | null; name: string; domain: string | null };
  ownerId: string | null;            // hubspot_owner_id
}

export interface DealResult extends RawDealResult {
  scoreValue: number;     // 0–100
  scoreContact: number;   // 0–100
  scoreRenewal: number;   // 0–100
  totalScore: number;     // 0–300
}

function norm(value: number, max: number): number {
  return max > 0 ? (value / max) * 100 : 0;
}

function daysUntilRenewal(deal: RawDealResult): number | null {
  if (!deal.contractEndDate) return null;
  return Math.round((new Date(deal.contractEndDate).getTime() - Date.now()) / 86_400_000);
}

export function scoreDealSet(deals: RawDealResult[]): DealResult[] {
  if (!deals.length) return [];

  const amounts = deals.map(d => d.amount ?? 0);
  const contactDays = deals.map(d =>
    d.lastContactedDate
      ? Math.round((Date.now() - new Date(d.lastContactedDate).getTime()) / 86_400_000)
      : 0
  );
  const renewalDays = deals.map(d => daysUntilRenewal(d));

  const maxAmount  = Math.max(...amounts, 0);
  const maxContact = Math.max(...contactDays, 0);

  const validRenewal = renewalDays.filter((d): d is number => d !== null);
  const maxRenewal   = validRenewal.length > 0 ? Math.max(...validRenewal) : null;

  return deals
    .map((deal, i) => {
      const scoreValue   = norm(amounts[i], maxAmount);
      const scoreContact = norm(contactDays[i], maxContact);

      let scoreRenewal: number;
      if (renewalDays[i] === null) {
        scoreRenewal = 0;
      } else if (maxRenewal === null || maxRenewal <= 0) {
        scoreRenewal = 100;
      } else {
        scoreRenewal = Math.min(100, Math.max(0,
          norm(maxRenewal - renewalDays[i], maxRenewal)));
      }

      return {
        ...deal,
        scoreValue:   Math.round(scoreValue),
        scoreContact: Math.round(scoreContact),
        scoreRenewal: Math.round(scoreRenewal),
        totalScore:   Math.round(scoreValue + scoreContact + scoreRenewal),
      };
    })
    .sort((a, b) => b.totalScore - a.totalScore);
}
