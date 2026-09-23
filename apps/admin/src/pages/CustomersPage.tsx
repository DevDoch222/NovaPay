import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, unwrapItems } from '../api';

type Row = {
  id: string;
  phone: string;
  tag?: string | null;
  status: string;
  kycTier: string;
  platformRole: string;
};

export function CustomersPage() {
  const [q, setQ] = useState('');
  const [items, setItems] = useState<Row[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  async function load(query = q) {
    setError(null);
    setLoading(true);
    try {
      const res = await api<{ items: Row[] }>(
        `/v1/admin/users?q=${encodeURIComponent(query)}&limit=50`,
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
    void load('');
  }, []);

  return (
    <div>
      <h1>Customers</h1>
      <p className="sub">Look up by phone, tag, email, or user id.</p>
      <div className="panel stack">
        <div className="row">
          <input
            style={{ flex: 1, minWidth: 200 }}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search…"
            onKeyDown={(e) => {
              if (e.key === 'Enter') void load();
            }}
          />
          <button type="button" onClick={() => void load()}>
            Search
          </button>
        </div>
        {error && <p className="error">{error}</p>}
        {loading ? <p className="sub">Loading…</p> : null}
        <table>
          <thead>
            <tr>
              <th>Phone</th>
              <th>Tag</th>
              <th>Status</th>
              <th>KYC</th>
              <th>Role</th>
            </tr>
          </thead>
          <tbody>
            {!loading && items.length === 0 ? (
              <tr>
                <td colSpan={5}>No customers found</td>
              </tr>
            ) : null}
            {items.map((u) => (
              <tr key={u.id}>
                <td>
                  <Link to={`/customers/${u.id}`}>{u.phone}</Link>
                </td>
                <td>{u.tag ?? '—'}</td>
                <td>
                  <span className={`badge ${u.status}`}>{u.status}</span>
                </td>
                <td>{u.kycTier}</td>
                <td>{u.platformRole}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
