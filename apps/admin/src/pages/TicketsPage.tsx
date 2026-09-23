import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, unwrapItems } from '../api';

type Row = {
  id: string;
  userId: string;
  subject: string;
  status: string;
  priority: string;
  updatedAt: string;
};

export function TicketsPage() {
  const [status, setStatus] = useState('open');
  const [items, setItems] = useState<Row[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  async function load() {
    setError(null);
    setLoading(true);
    const params = new URLSearchParams({ limit: '50' });
    if (status) params.set('status', status);
    try {
      const res = await api<{ items: Row[] }>(
        `/v1/admin/support/tickets?${params}`,
      );
      setItems(unwrapItems(res));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed');
      setItems([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, [status]);

  return (
    <div>
      <h1>Support queue</h1>
      <p className="sub">Answer customer requests and keep status updated.</p>
      <div className="panel stack">
        <select value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">All</option>
          <option value="open">open</option>
          <option value="in_progress">in_progress</option>
          <option value="waiting_customer">waiting_customer</option>
          <option value="resolved">resolved</option>
          <option value="closed">closed</option>
        </select>
        {error && <p className="error">{error}</p>}
        {loading ? <p className="sub">Loading…</p> : null}
        <table>
          <thead>
            <tr>
              <th>Subject</th>
              <th>Status</th>
              <th>Priority</th>
              <th>Customer</th>
              <th>Updated</th>
            </tr>
          </thead>
          <tbody>
            {!loading && items.length === 0 ? (
              <tr>
                <td colSpan={5}>No tickets</td>
              </tr>
            ) : null}
            {items.map((t) => (
              <tr key={t.id}>
                <td>
                  <Link to={`/tickets/${t.id}`}>{t.subject}</Link>
                </td>
                <td>
                  <span className={`badge ${t.status}`}>{t.status}</span>
                </td>
                <td>{t.priority}</td>
                <td>
                  <Link to={`/customers/${t.userId}`}>
                    {t.userId.slice(0, 8)}…
                  </Link>
                </td>
                <td>{new Date(t.updatedAt).toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
