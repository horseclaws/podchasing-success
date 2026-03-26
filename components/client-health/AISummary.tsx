export default function AISummary({ summary }: { summary: string }) {
  return (
    <div className="rounded-2xl p-5" style={{ backgroundColor: '#FFFDE8', border: '1px solid rgba(255,239,112,0.6)' }}>
      <h3 className="text-xs font-semibold uppercase tracking-wide mb-2" style={{ color: '#92640a' }}>AI Summary</h3>
      <p className="text-sm leading-relaxed whitespace-pre-wrap" style={{ color: '#1a1a2e' }}>{summary}</p>
    </div>
  );
}
