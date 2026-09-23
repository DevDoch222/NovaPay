import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, unwrapItems } from '../api';

type KycRow = {
  id: string;
  documentType: string;
  documentNumber: string | null;
  verificationStatus: string;
  metadata: { fullName?: string | null };
  createdAt: string;
  user: {
    id: string;
    phone: string;
    tag?: string | null;
    kycTier: string;
  };
};

export function KycPage() {
  const [status, setStatus] = useState<'pending' | 'approved' | 'rejected'>(
    'pending',
  );
  const [items, setItems] = useState<KycRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(true);

  async function load(nextStatus = status) {
    setError(null);
    setLoading(true);
    try {
      const res = await api<{ items: KycRow[] }>(
        `/v1/admin/kyc?status=${nextStatus}&limit=50`,
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
    void load(status);
  }, [status]);

  async function review(
    id: string,
    decision: 'approve' | 'reject',
    kycTier?: 'tier_1' | 'tier_2',
  ) {
    setBusyId(id);
    setError(null);
    try {
      await api(`/v1/admin/kyc/${id}/review`, {
        method: 'POST',
        body: JSON.stringify({
          decision,
          kycTier,
          reason: reason.trim() || undefined,
        }),
      });
      setReason('');
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed');
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div>
      <h1>KYC review</h1>
      <p className="sub">
        Manual identity checks — approve to unlock send limits without a paid
        vendor.
      </p>
      <div className="panel stack">
        <div className="row">
          {(['pending', 'approved', 'rejected'] as const).map((s) => (
            <button
              key={s}
              type="button"
              className={status === s ? undefined : 'secondary'}
              onClick={() => setStatus(s)}
            >
              {s}
            </button>
          ))}
        </div>
        <input
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="Optional review note (saved on next action)"
        />
        {error && <p className="error">{error}</p>}
        {loading ? <p className="sub">Loading…</p> : null}
        <table>
          <thead>
            <tr>
              <th>Customer</th>
              <th>Name</th>
              <th>Document</th>
              <th>Submitted</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {items.length === 0 ? (
              <tr>
                <td colSpan={5}>
                  {loading ? '…' : `No ${status} submissions`}
                </td>
              </tr>
            ) : (
              items.map((r) => (
                <tr key={r.id}>
                  <td>
                    <Link to={`/customers/${r.user.id}`}>{r.user.phone}</Link>
                    <div className="sub" style={{ margin: 0 }}>
                      {r.user.tag ? `@${r.user.tag}` : r.user.kycTier}
                    </div>
                  </td>
                  <td>{r.metadata?.fullName ?? '—'}</td>
                  <td>
                    <div>{r.documentType}</div>
                    <div className="mono">{r.documentNumber ?? '—'}</div>
                  </td>
                  <td>{new Date(r.createdAt).toLocaleString()}</td>
                  <td className="row">
                    {r.verificationStatus === 'pending' ? (
                      <>
                        <button
                          type="button"
                          disabled={busyId === r.id}
                          onClick={() => void review(r.id, 'approve', 'tier_1')}
                        >
                          Approve T1
                        </button>
                        <button
                          type="button"
                          className="secondary"
                          disabled={busyId === r.id}
                          onClick={() => void review(r.id, 'approve', 'tier_2')}
                        >
                          Approve T2
                        </button>
                        <button
                          type="button"
                          className="danger"
                          disabled={busyId === r.id}
                          onClick={() => void review(r.id, 'reject')}
                        >
                          Reject
                        </button>
                      </>
                    ) : (
                      <span className={`badge ${r.verificationStatus}`}>
                        {r.verificationStatus}
                      </span>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
