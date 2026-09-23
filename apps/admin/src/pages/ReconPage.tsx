import { useState } from 'react';
import { api } from '../api';

export function ReconPage() {
  const today = new Date().toISOString().slice(0, 10);
  const [date, setDate] = useState(today);
  const [report, setReport] = useState<unknown>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function run() {
    setBusy(true);
    setError(null);
    try {
      const res = await api(`/v1/admin/reconciliation/run`, {
        method: 'POST',
        body: JSON.stringify({ date }),
      });
      setReport(res);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed');
    } finally {
      setBusy(false);
    }
  }

  async function loadCached() {
    setBusy(true);
    setError(null);
    try {
      setReport(await api(`/v1/admin/reconciliation/report/${date}`));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <h1>Reconciliation</h1>
      <p className="sub">Flutterwave vs ledger for a UTC day.</p>
      <div className="panel stack">
        <div className="row">
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
          />
          <button type="button" disabled={busy} onClick={() => void run()}>
            Run
          </button>
          <button
            type="button"
            className="secondary"
            disabled={busy}
            onClick={() => void loadCached()}
          >
            Load report
          </button>
        </div>
        {error && <p className="error">{error}</p>}
        {report != null && (
          <pre style={{ overflow: 'auto', fontSize: 12, maxHeight: 480 }}>
            {JSON.stringify(report, null, 2)}
          </pre>
        )}
      </div>
    </div>
  );
}
