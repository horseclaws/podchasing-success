'use client';
import InsightCard from '@/components/ui/InsightCard';

interface Member {
  id: string;
  name: string;
  email: string;
  hubspot_owner_id: string;
  created_at: string;
}

interface Props {
  members: Member[];
  currentUserId: string;
  onRemove: (id: string) => void;
}

export default function TeamMemberList({ members, currentUserId, onRemove }: Props) {
  return (
    <InsightCard className="p-0 overflow-hidden">
      <table className="w-full text-sm">
        <thead className="bg-gray-50 border-b border-gray-200">
          <tr>
            <th className="text-left px-4 py-2 font-medium text-gray-600">Name</th>
            <th className="text-left px-4 py-2 font-medium text-gray-600">Email</th>
            <th className="text-left px-4 py-2 font-medium text-gray-600">HubSpot Owner ID</th>
            <th className="text-left px-4 py-2 font-medium text-gray-600">Joined</th>
            <th className="px-4 py-2" />
          </tr>
        </thead>
        <tbody>
          {members.map((m) => (
            <tr key={m.id} className="border-t border-gray-100">
              <td className="px-4 py-2 text-foreground">{m.name}</td>
              <td className="px-4 py-2 text-gray-600">{m.email}</td>
              <td className="px-4 py-2 text-gray-600">{m.hubspot_owner_id}</td>
              <td className="px-4 py-2 text-gray-400">{new Date(m.created_at).toLocaleDateString()}</td>
              <td className="px-4 py-2 text-right">
                <button
                  onClick={() => onRemove(m.id)}
                  disabled={m.id === currentUserId}
                  className="text-xs text-red-500 hover:text-red-700 disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  Remove
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </InsightCard>
  );
}
