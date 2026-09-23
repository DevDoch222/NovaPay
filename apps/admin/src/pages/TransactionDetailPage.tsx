import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api } from '../api';

export function TransactionDetailPage() {
  const { id } = useParams();
  const [data, setData] = useState<{
    transaction: {
      id: string;
      userId?: string | null;
      type: string;
      status: string;
      amountMinor: string;
      feeMinor: string;
      currency: string;
      externalReference?: string | null;
      metadata: Record<string, unknown>;
    };
    ledgerEntries: {
      id: string;
      walletId: string;
      direction: string;
      amountMinor: string;
      balanceAfterMinor: string;
    }[];
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    setError(null);
    void api<NonNullable<typeof data>>(`/v1/admin/transactions/${id}`)
      .then(setData)
      .catch((e) => {
        setData(null);
        setError(e instanceof Error ? e.message : 'Failed');
      })
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) return <p className="sub">Loading transaction…</p>;

  if (!data) {
    return (
      <div className="stack">
        <p className="error">{error ?? 'Transaction not found'}</p>
        <Link to="/transactions">← Back to transactions</Link>
      </div>
    );
  }

  const t = data.transaction;

  return (
    <div className="stack">
      <p className="sub" style={{ margin: 0 }}>
        <Link to="/transactions">← Transactions</Link>
      </p>
      <div>
        <h1>Transaction</h1>
        <p className="sub mono">{t.id}</p>
      </div>
      <div className="panel">
        <p>
          <strong>{t.type}</strong>{' '}
          <span className={`badge ${t.status}`}>{t.status}</span>
        </p>
        <p className="mono">
          {t.amountMinor} {t.currency} (fee {t.feeMinor})
        </p>
        {t.userId && (
          <p>
            Customer:{' '}
            <Link to={`/customers/${t.userId}`}>{t.userId.slice(0, 8)}…</Link>
          </p>
        )}
        <p className="mono">ext: {t.externalReference ?? '—'}</p>
        <pre className="code-block">
          {JSON.stringify(t.metadata, null, 2)}
        </pre>
      </div>
      <div className="panel">
        <h3>Ledger legs</h3>
        <table>
          <thead>
            <tr>
              <th>Dir</th>
              <th>Amount</th>
              <th>Balance after</th>
              <th>Wallet</th>
            </tr>
          </thead>
          <tbody>
            {data.ledgerEntries.length === 0 ? (
              <tr>
                <td colSpan={4}>No ledger entries</td>
              </tr>
            ) : null}
            {data.ledgerEntries.map((e) => (
              <tr key={e.id}>
                <td>{e.direction}</td>
                <td className="mono">{e.amountMinor}</td>
                <td className="mono">{e.balanceAfterMinor}</td>
                <td className="mono">{e.walletId.slice(0, 8)}…</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
