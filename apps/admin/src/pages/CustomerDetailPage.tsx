import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api } from '../api';

export function CustomerDetailPage() {
  const { id } = useParams();
  const [data, setData] = useState<{
    user: {
      id: string;
      phone: string;
      tag?: string | null;
      status: string;
      kycTier: string;
      platformRole: string;
    };
    wallets: { currency: string; balanceMinor: string; status: string }[];
    recentTransactions: {
      id: string;
      type: string;
      status: string;
      amountMinor: string;
      currency: string;
    }[];
    kycRecords?: {
      id: string;
      documentType: string;
      documentNumber: string | null;
      verificationStatus: string;
      createdAt: string;
    }[];
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionError, setActionError] = useState<string | null>(null);
  const [ticketSubject, setTicketSubject] = useState('');
  const [ticketBody, setTicketBody] = useState('');

  async function load() {
    if (!id) return;
    setError(null);
    setLoading(true);
    try {
      setData(
        await api<NonNullable<typeof data>>(`/v1/admin/users/${id}`),
      );
    } catch (e) {
      setData(null);
      setError(e instanceof Error ? e.message : 'Failed');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, [id]);

  async function setStatus(status: 'active' | 'suspended' | 'closed') {
    if (!id) return;
    setActionError(null);
    try {
      await api(`/v1/admin/users/${id}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status }),
      });
      await load();
    } catch (e) {
      setActionError(e instanceof Error ? e.message : 'Failed');
    }
  }

  async function openTicket() {
    if (!id || !ticketSubject.trim() || !ticketBody.trim()) {
      setActionError('Subject and message are required');
      return;
    }
    setActionError(null);
    try {
      await api('/v1/admin/support/tickets', {
        method: 'POST',
        body: JSON.stringify({
          userId: id,
          subject: ticketSubject.trim(),
          body: ticketBody.trim(),
        }),
      });
      setTicketSubject('');
      setTicketBody('');
      setActionError(null);
      alert('Ticket opened');
    } catch (e) {
      setActionError(e instanceof Error ? e.message : 'Failed');
    }
  }

  if (loading) {
    return <p className="sub">Loading customer…</p>;
  }

  if (!data) {
    return (
      <div className="stack">
        <p className="error">{error ?? 'Customer not found'}</p>
        <Link to="/">← Back to customers</Link>
      </div>
    );
  }

  const u = data.user;
  return (
    <div className="stack">
      <p className="sub" style={{ margin: 0 }}>
        <Link to="/">← Customers</Link>
      </p>
      <div>
        <h1>{u.phone}</h1>
        <p className="sub">
          {u.tag ? `@${u.tag}` : 'no tag'} · {u.kycTier} · {u.platformRole}
        </p>
      </div>
      {actionError ? <p className="error">{actionError}</p> : null}
      <div className="panel row">
        <span className={`badge ${u.status}`}>{u.status}</span>
        <button type="button" className="secondary" onClick={() => void setStatus('active')}>
          Activate
        </button>
        <button type="button" className="secondary" onClick={() => void setStatus('suspended')}>
          Suspend
        </button>
        <button type="button" className="danger" onClick={() => void setStatus('closed')}>
          Close
        </button>
      </div>
      <div className="panel">
        <h3>KYC submissions</h3>
        {(data.kycRecords?.length ?? 0) === 0 ? (
          <p className="sub">No KYC records</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Document</th>
                <th>Number</th>
                <th>Status</th>
                <th>Submitted</th>
              </tr>
            </thead>
            <tbody>
              {data.kycRecords!.map((k) => (
                <tr key={k.id}>
                  <td>{k.documentType}</td>
                  <td className="mono">{k.documentNumber ?? '—'}</td>
                  <td>
                    <span className={`badge ${k.verificationStatus}`}>
                      {k.verificationStatus}
                    </span>
                  </td>
                  <td>{new Date(k.createdAt).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <p className="sub" style={{ marginTop: 8 }}>
          Review queue: <Link to="/kyc">KYC review</Link>
        </p>
      </div>
      <div className="panel">
        <h3>Wallets</h3>
        <table>
          <thead>
            <tr>
              <th>Currency</th>
              <th>Balance (minor)</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {data.wallets.map((w) => (
              <tr key={w.currency}>
                <td>{w.currency}</td>
                <td className="mono">{w.balanceMinor}</td>
                <td>{w.status}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="panel">
        <h3>Recent transactions</h3>
        <table>
          <thead>
            <tr>
              <th>Type</th>
              <th>Status</th>
              <th>Amount</th>
              <th>Id</th>
            </tr>
          </thead>
          <tbody>
            {data.recentTransactions.length === 0 ? (
              <tr>
                <td colSpan={4}>No transactions</td>
              </tr>
            ) : null}
            {data.recentTransactions.map((t) => (
              <tr key={t.id}>
                <td>{t.type}</td>
                <td>
                  <span className={`badge ${t.status}`}>{t.status}</span>
                </td>
                <td className="mono">
                  {t.amountMinor} {t.currency}
                </td>
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
      <div className="panel stack">
        <h3>Open support ticket</h3>
        <input
          value={ticketSubject}
          onChange={(e) => setTicketSubject(e.target.value)}
          placeholder="Subject"
        />
        <textarea
          rows={4}
          value={ticketBody}
          onChange={(e) => setTicketBody(e.target.value)}
          placeholder="Issue details…"
        />
        <button type="button" onClick={() => void openTicket()}>
          Create ticket
        </button>
      </div>
    </div>
  );
}
