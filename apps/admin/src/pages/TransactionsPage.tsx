import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, unwrapItems } from '../api';

type Row = {
  id: string;
  userId?: string | null;
  type: string;
  status: string;
  amountMinor: string;
  currency: string;
  externalReference?: string | null;
};

export function TransactionsPage() {
  const [q, setQ] = useState('');
  const [status, setStatus] = useState('');
  const [type, setType] = useState('');
  const [items, setItems] = useState<Row[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  async function load() {
    setError(null);
    setLoading(true);
    const params = new URLSearchParams({ limit: '50' });
    if (q) params.set('q', q);
    if (status) params.set('status', status);
    if (type) params.set('type', type);
    try {
      const res = await api<{ items: Row[] }>(
        `/v1/admin/transactions?${params}`,
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
  }, []);

  return (
    <div>
      <h1>Transactions</h1>
      <p className="sub">Track by id, external reference, status, or type.</p>
      <div className="panel stack">
        <div className="row">
          <input
            style={{ flex: 1, minWidth: 180 }}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="id / external ref / idempotency"
            onKeyDown={(e) => {
              if (e.key === 'Enter') void load();
            }}
          />
          <select value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="">Any status</option>
            <option value="pending">pending</option>
            <option value="processing">processing</option>
            <option value="completed">completed</option>
            <option value="failed">failed</option>
            <option value="reversed">reversed</option>
          </select>
          <select value={type} onChange={(e) => setType(e.target.value)}>
            <option value="">Any type</option>
            <option value="fund">fund</option>
            <option value="payout">payout</option>
            <option value="card_spend">card_spend</option>
            <option value="convert">convert</option>
            <option value="receive">receive</option>
          </select>
          <button type="button" onClick={() => void load()}>
            Filter
          </button>
        </div>
        {error && <p className="error">{error}</p>}
        {loading ? <p className="sub">Loading…</p> : null}
        <table>
          <thead>
            <tr>
              <th>Type</th>
              <th>Status</th>
              <th>Amount</th>
              <th>External</th>
              <th>Id</th>
            </tr>
          </thead>
          <tbody>
            {!loading && items.length === 0 ? (
              <tr>
                <td colSpan={5}>No transactions</td>
              </tr>
            ) : null}
            {items.map((t) => (
              <tr key={t.id}>
                <td>{t.type}</td>
                <td>
                  <span className={`badge ${t.status}`}>{t.status}</span>
                </td>
                <td className="mono">
                  {t.amountMinor} {t.currency}
                </td>
                <td className="mono">{t.externalReference ?? '—'}</td>
                <td>
                  <Link className="mono" to={`/transactions/${t.id}`}>
                    {t.id.slice(0, 8)}…
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
