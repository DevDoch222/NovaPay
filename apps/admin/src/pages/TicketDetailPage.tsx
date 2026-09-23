import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api } from '../api';

export function TicketDetailPage() {
  const { id } = useParams();
  const [data, setData] = useState<{
    ticket: {
      id: string;
      subject: string;
      status: string;
      userId: string;
    };
    customer: { phone: string; tag?: string | null } | null;
    messages: {
      id: string;
      body: string;
      isStaff: boolean;
      createdAt: string;
    }[];
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [body, setBody] = useState('');
  const [status, setStatus] = useState('waiting_customer');
  const [sending, setSending] = useState(false);

  async function load() {
    if (!id) return;
    setError(null);
    setLoading(true);
    try {
      const res = await api<NonNullable<typeof data>>(
        `/v1/admin/support/tickets/${id}`,
      );
      setData(res);
      setStatus(res.ticket.status === 'open' ? 'in_progress' : res.ticket.status);
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

  async function reply() {
    if (!id || !body.trim()) return;
    setSending(true);
    setError(null);
    try {
      await api(`/v1/admin/support/tickets/${id}/messages`, {
        method: 'POST',
        body: JSON.stringify({ body: body.trim(), status }),
      });
      setBody('');
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed');
    } finally {
      setSending(false);
    }
  }

  if (loading) return <p className="sub">Loading ticket…</p>;

  if (!data) {
    return (
      <div className="stack">
        <p className="error">{error ?? 'Ticket not found'}</p>
        <Link to="/tickets">← Back to support</Link>
      </div>
    );
  }

  return (
    <div className="stack">
      <p className="sub" style={{ margin: 0 }}>
        <Link to="/tickets">← Support queue</Link>
      </p>
      <div>
        <h1>{data.ticket.subject}</h1>
        <p className="sub">
          <span className={`badge ${data.ticket.status}`}>
            {data.ticket.status}
          </span>{' '}
          ·{' '}
          <Link to={`/customers/${data.ticket.userId}`}>
            {data.customer?.phone ?? data.ticket.userId}
          </Link>
        </p>
      </div>
      <div className="panel stack">
        {data.messages.length === 0 ? (
          <p className="sub">No messages yet</p>
        ) : null}
        {data.messages.map((m) => (
          <div
            key={m.id}
            style={{
              borderLeft: m.isStaff
                ? '3px solid var(--accent)'
                : '3px solid var(--line)',
              paddingLeft: 10,
            }}
          >
            <div className="sub">
              {m.isStaff ? 'Staff' : 'Customer'} ·{' '}
              {new Date(m.createdAt).toLocaleString()}
            </div>
            <div>{m.body}</div>
          </div>
        ))}
      </div>
      <div className="panel stack">
        <textarea
          rows={4}
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="Reply to customer…"
        />
        {error && <p className="error">{error}</p>}
        <div className="row">
          <select value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="open">open</option>
            <option value="in_progress">in_progress</option>
            <option value="waiting_customer">waiting_customer</option>
            <option value="resolved">resolved</option>
            <option value="closed">closed</option>
          </select>
          <button
            type="button"
            disabled={sending || !body.trim()}
            onClick={() => void reply()}
          >
            Send reply
          </button>
        </div>
      </div>
    </div>
  );
}
