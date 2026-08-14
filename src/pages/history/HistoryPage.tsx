import { useEffect, useState } from 'react';
import type { HistoryRecord } from '../../types/entities';
import { historyService } from '../../services/history/historyService';
import { useAuth } from '../../hooks/useAuth';
import { hasPermission } from '../../services/auth/permissions';

export default function HistoryPage() {
  const { session } = useAuth();
  const canDelete = !!session && hasPermission(session.role, 'history.delete');
  const [records, setRecords] = useState<HistoryRecord[]>([]);
  const [showCleanupHint, setShowCleanupHint] = useState(false);

  const reload = async () => {
    setRecords(await historyService.listAll());
    setShowCleanupHint(canDelete && (await historyService.suggestsCleanup()));
  };

  useEffect(() => { reload(); }, [session]); // eslint-disable-line react-hooks/exhaustive-deps

  async function handleCleanup() {
    const cutoff = new Date();
    cutoff.setMonth(cutoff.getMonth() - 1);
    const count = await historyService.clearOlderThan(cutoff.toISOString());
    alert(`Cleaned up ${count} records older than last month.`);
    reload();
  }

  return (
    <div>
      <h1>History</h1>
      {showCleanupHint && (
        <div className="glass-panel" style={{ padding: 12, marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: 15 }}>You've entered a new month — consider cleaning up older history records.</span>
          <button onClick={handleCleanup} style={{ padding: '6px 12px', border: 'none', borderRadius: 8, background: 'var(--color-warning)', cursor: 'pointer' }}>Clean Up</button>
        </div>
      )}
      <div className="glass-panel" style={{ padding: 0 }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 15 }}>
          <thead>
            <tr style={{ background: 'rgba(0,59,122,0.06)', textAlign: 'left' }}>
              <th style={th}>Date</th><th style={th}>Type</th><th style={th}>Customer</th><th style={th}>Gender</th><th style={th}>Language</th>
            </tr>
          </thead>
          <tbody>
            {records.map((r) => (
              <tr key={r.id} style={{ borderTop: '1px solid #eee' }}>
                <td style={td}>{new Date(r.createdAt).toLocaleString()}</td>
                <td style={td}>{r.type}</td>
                <td style={td}>{r.customerName}</td>
                <td style={td}>{r.gender}</td>
                <td style={td}>{r.language}</td>
              </tr>
            ))}
            {records.length === 0 && <tr><td style={td} colSpan={5}>No history yet.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}

const th: React.CSSProperties = { padding: '10px 14px', fontWeight: 600 };
const td: React.CSSProperties = { padding: '10px 14px' };
