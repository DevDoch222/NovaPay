import { useEffect, useState } from 'react';
import { api, unwrapItems } from '../api';

type Alert = {
  id: string;
  ruleName: string;
  severity: string;
  status: string;
  description: string;
  userId?: string | null;
};

export function AlertsPage() {
  const [items, setItems] = useState<Alert[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);

  async function load() {
    setError(null);
    setLoading(true);
    try {
      const res = await api<{ items: Alert[] }>(
        '/v1/admin/compliance/alerts?status=open&limit=50',
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

  async function update(id: string, status: string) {
    setBusyId(id);
    setError(null);
    try {
      await api(`/v1/admin/compliance/alerts/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ status }),
      });
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed');
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div>
      <h1>AML alerts</h1>
      <p className="sub">Review open compliance alerts.</p>
      <div className="panel stack">
        {error && <p className="error">{error}</p>}
        {loading ? <p className="sub">Loading…</p> : null}
        <table>
          <thead>
            <tr>
              <th>Rule</th>
              <th>Severity</th>
              <th>Description</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {!loading && items.length === 0 ? (
              <tr>
                <td colSpan={4}>No open alerts</td>
              </tr>
            ) : null}
            {items.map((a) => (
              <tr key={a.id}>
                <td>{a.ruleName}</td>
                <td>{a.severity}</td>
                <td>{a.description}</td>
                <td className="row">
                  <button
                    type="button"
                    className="secondary"
                    disabled={busyId === a.id}
                    onClick={() => void update(a.id, 'under_review')}
                  >
                    Review
                  </button>
                  <button
                    type="button"
                    disabled={busyId === a.id}
                    onClick={() => void update(a.id, 'dismissed')}
                  >
                    Dismiss
                  </button>
                  <button
                    type="button"
                    className="danger"
                    disabled={busyId === a.id}
                    onClick={() => void update(a.id, 'confirmed')}
                  >
                    Confirm
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
