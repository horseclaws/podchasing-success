import CalloutBlock from '@/components/ui/CalloutBlock';

export default function AISummary({ summary }: { summary: string }) {
  return (
    <CalloutBlock title="Key Takeaways">
      <p className="text-sm leading-relaxed whitespace-pre-wrap">{summary}</p>
    </CalloutBlock>
  );
}
