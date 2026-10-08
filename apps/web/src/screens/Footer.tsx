import { NOTICE, SCOUT_NOTICE, type AppConfig } from '@crosstalk/shared';

/** The notice on every page. Episodes made from a Scout topic say their brief comes from the linked sources. */
export function Footer({ config, briefed }: { config?: AppConfig | null; briefed?: boolean }) {
  const real = config?.providerMode === 'openrouter';
  return (
    <div className="notice">
      <span>{briefed ? SCOUT_NOTICE : NOTICE}</span>
      <span>{real ? `Real models via OpenRouter: ${config!.models.A} and ${config!.models.B}.` : 'Mock mode: all speech is scripted sample text.'}</span>
    </div>
  );
}
