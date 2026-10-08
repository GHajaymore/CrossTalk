import { VERDICTS, type ConversationView } from '@crosstalk/shared';
import { api } from '../api/client';

/** Hot seat: you decide who moved you. Not Iris, not the hosts. */
export function VerdictCard({ view, setView, toast }: { view: ConversationView; setView: (v: ConversationView) => void; toast: (m: string) => void }) {
  const pick = async (v: keyof typeof VERDICTS) => {
    try { setView(await api.verdict(view.id, v)); } catch (e) { toast((e as Error).message); }
  };
  return (
    <section className="verdict" aria-label="Who moved you?">
      <div><span className="tag">Hot seat · your call</span><h3>Who moved you?</h3>
        <p className="hint">{view.speakers.A.name} defended the less popular side; {view.speakers.B.name} tried to win them over. Only you decide.</p></div>
      <div className="dock-row" role="group" aria-label="Your verdict">
        {(Object.entries(VERDICTS) as [keyof typeof VERDICTS, string][]).map(([k, l]) => (
          <button key={k} className="chip" aria-pressed={view.verdict === k} onClick={() => pick(k)}>{l}</button>
        ))}
      </div>
    </section>
  );
}
