import type { DealResult } from '@/lib/deal-scoring';

interface Props {
  deals: DealResult[];
}

const BAR_COLORS = ['bg-brand-purple', 'bg-brand-cyan', 'bg-brand-mint', 'bg-brand-pink'];

function DistributionTile({ title, counts }: { title: string; counts: Record<string, number> }) {
  const entries = Object.entries(counts).sort((a, b) => b[1] - a[1]);
  const max = entries[0]?.[1] ?? 1;
  return (
    <div className="rounded-2xl p-4 bg-white border border-violet-100">
      <p className="text-xs font-semibold uppercase tracking-wide mb-3 text-brand-purple">{title}</p>
      <div className="space-y-2">
        {entries.map(([label, count], i) => (
          <div key={label}>
            <div className="flex justify-between text-xs mb-0.5">
              <span className="text-gray-700">{label}</span>
              <span className="text-gray-400">{count}</span>
            </div>
            <div className="h-1.5 rounded-full bg-violet-50">
              <div
                className={`h-1.5 rounded-full ${BAR_COLORS[i % BAR_COLORS.length]}`}
                style={{ width: `${(count / max) * 100}%` }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function ResultsDashboard({ deals }: Props) {
  const totalValue = deals.reduce((sum, d) => sum + (d.amount ?? 0), 0);

  const byType: Record<string, number> = {};
  for (const d of deals) {
    const key = d.businessType || 'Unknown';
    byType[key] = (byType[key] ?? 0) + 1;
  }

  const byStage: Record<string, number> = {};
  for (const d of deals) {
    const key = d.stage || 'Unknown';
    byStage[key] = (byStage[key] ?? 0) + 1;
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-5">
      <div className="rounded-2xl p-4 bg-white border border-violet-100">
        <p className="text-xs font-semibold uppercase tracking-wide mb-1 text-brand-purple">Total Contract Value</p>
        <p className="text-2xl font-bold text-foreground">
          ${Math.round(totalValue).toLocaleString('en-US')}
        </p>
        <p className="text-xs mt-0.5 text-gray-400">
          {deals.length} deal{deals.length !== 1 ? 's' : ''}
        </p>
      </div>
      <DistributionTile title="By Business Type" counts={byType} />
      <DistributionTile title="By Deal Stage" counts={byStage} />
    </div>
  );
}
