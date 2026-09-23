import { useState } from 'react';
import { api } from '../api';

/**
 * Disputes are opened by customers; staff resolve via this panel.
 * List is filtered from admin alerts with rule card_dispute_opened,
 * plus resolve-by-id for known dispute UUIDs.
 */
export function DisputesPage() {
  const [disputeId, setDisputeId] = useState('');
  const [note, setNote] = useState('');
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function resolve(outcome: 'won' | 'lost') {
    setError(null);
    setResult(null);
    try {
      const res = await api<{ id: string; status: string }>(
        `/v1/admin/compliance/disputes/${disputeId}/resolve`,
        {
          method: 'POST',
          body: JSON.stringify({ outcome, resolutionNote: note || undefined }),
        },
      );
      setResult(`Dispute ${res.id} → ${res.status}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed');
    }
  }

  return (
    <div>
      <h1>Card disputes</h1>
      <p className="sub">
        Paste a dispute id from a customer dispute or compliance alert, then
        mark won (ledger reverse) or lost.
      </p>
      <div className="panel stack">
        <input
          value={disputeId}
          onChange={(e) => setDisputeId(e.target.value)}
          placeholder="Dispute UUID"
        />
        <textarea
          rows={3}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Resolution note"
        />
        <div className="row">
          <button type="button" onClick={() => void resolve('won')}>
            Customer won
          </button>
          <button
            type="button"
            className="secondary"
            onClick={() => void resolve('lost')}
          >
            Customer lost
          </button>
        </div>
        {error && <p className="error">{error}</p>}
        {result && <p className="sub">{result}</p>}
      </div>
    </div>
  );
}
