export default function AISummary({ summary }: { summary: string }) {
  return (
    <div className="border border-gray-200 rounded p-4 bg-blue-50">
      <h3 className="text-sm font-semibold text-gray-700 mb-2">AI Summary</h3>
      <p className="text-sm text-gray-700 whitespace-pre-wrap">{summary}</p>
    </div>
  );
}
