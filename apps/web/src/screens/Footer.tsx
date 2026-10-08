import { NOTICE, type AppConfig } from '@crosstalk/shared';

export function Footer({ config }: { config?: AppConfig | null }) {
  const real = config?.providerMode === 'openrouter';
  return (
    <div className="notice">
      <span>{NOTICE}</span>
      <span>{real ? `Real models via OpenRouter: ${config!.models.A} and ${config!.models.B}.` : 'Mock mode: all speech is scripted sample text.'}</span>
    </div>
  );
}
