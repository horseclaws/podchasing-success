'use client';
import { useState } from 'react';
import type { DashboardContact, DashboardDeal, LoginTier } from '@/lib/dashboard';
import { PageHeader } from '@/components/ui';
import DashboardSubNav from './DashboardSubNav';
import OwnerToggle from './OwnerToggle';
import OverviewTab from './OverviewTab';
import RenewalsTab from './RenewalsTab';
import OutreachTab from './OutreachTab';
import SeatsTab from './SeatsTab';
import UserSidePanel from './UserSidePanel';

type Tab = 'overview' | 'renewals' | 'outreach' | 'seats';

interface Props {
  isManager: boolean;
  hubspotOwnerId: string;
}

export default function DashboardClient({ isManager, hubspotOwnerId }: Props) {
  const [tab, setTab] = useState<Tab>('overview');
  const [ownerId, setOwnerId] = useState<string>(isManager ? 'all' : hubspotOwnerId);
  const [pendingTierFilter, setPendingTierFilter] = useState<LoginTier | null>(null);
  const [panel, setPanel] = useState<{
    contact: DashboardContact;
    deal: Pick<DashboardDeal, 'id' | 'name' | 'stage' | 'amount' | 'contractEndDate'>;
  } | null>(null);

  function navigateToSeats(tier: LoginTier) {
    setPendingTierFilter(tier);
    setTab('seats');
  }

  function openPanel(
    contact: DashboardContact,
    deal: Pick<DashboardDeal, 'id' | 'name' | 'stage' | 'amount' | 'contractEndDate'>
  ) {
    setPanel({ contact, deal });
  }

  return (
    <div>
      <PageHeader title="Dashboard" subtitle="Your book of business at a glance" />

      {isManager && (
        <OwnerToggle selected={ownerId} onChange={setOwnerId} currentUserId={hubspotOwnerId} />
      )}

      <DashboardSubNav active={tab} onChange={t => { setTab(t); if (t !== 'seats') setPendingTierFilter(null); }} />

      {tab === 'overview' && (
        <OverviewTab ownerId={ownerId} onNavigateToSeats={navigateToSeats} />
      )}
      {tab === 'renewals' && (
        <RenewalsTab ownerId={ownerId} onContactClick={openPanel} />
      )}
      {tab === 'outreach' && (
        <OutreachTab ownerId={ownerId} showOwnerColumn={isManager && ownerId === 'all'} />
      )}
      {tab === 'seats' && (
        <SeatsTab
          ownerId={ownerId}
          initialTierFilter={pendingTierFilter}
          onContactClick={openPanel}
        />
      )}

      {panel && (
        <UserSidePanel
          contact={panel.contact}
          deal={panel.deal}
          onClose={() => setPanel(null)}
        />
      )}
    </div>
  );
}
