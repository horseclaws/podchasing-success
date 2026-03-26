import type { DealResult } from '@/lib/deal-scoring';

interface Props {
  deals: DealResult[];   // full scored set, not capped
}

const BAR_COLORS = ['#4A027D', '#0DAAC9', '#2BDA9F', '#FB0467'];

function DistributionTile({ title, counts }: { title: string; counts: Record<string, number> }) {
  const entries = Object.entries(counts).sort((a, b) => b[1] - a[1]);
  const max = entries[0]?.[1] ?? 1;
  return (
    <div className="rounded-2xl p-4" style={{ backgroundColor: '#ffffff', border: '1px solid #ede9f5' }}>
      <p className="text-xs font-semibold uppercase tracking-wide mb-3" style={{ color: '#4A027D' }}>{title}</p>
      <div className="space-y-2">
        {entries.map(([label, count], i) => (
          <div key={label}>
            <div className="flex justify-between text-xs mb-0.5">
              <span style={{ color: '#374151' }}>{label}</span>
              <span style={{ color: '#9ca3af' }}>{count}</span>
            </div>
            <div className="h-1.5 rounded-full" style={{ backgroundColor: '#F3F0F8' }}>
              <div
                className="h-1.5 rounded-full"
                style={{
                  width: `${(count / max) * 100}%`,
                  backgroundColor: BAR_COLORS[i % BAR_COLORS.length],
                }}
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
      {/* Total value tile */}
      <div className="rounded-2xl p-4" style={{ backgroundColor: '#ffffff', border: '1px solid #ede9f5' }}>
        <p className="text-xs font-semibold uppercase tracking-wide mb-1" style={{ color: '#4A027D' }}>Total Contract Value</p>
        <p className="text-2xl font-bold" style={{ color: '#1a1a2e' }}>
          ${Math.round(totalValue).toLocaleString('en-US')}
        </p>
        <p className="text-xs mt-0.5" style={{ color: '#9ca3af' }}>
          {deals.length} deal{deals.length !== 1 ? 's' : ''}
        </p>
      </div>
      <DistributionTile title="By Business Type" counts={byType} />
      <DistributionTile title="By Deal Stage" counts={byStage} />
    </div>
  );
}
