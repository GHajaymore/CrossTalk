import { TEMPERATURES, type Temperature } from '@crosstalk/shared';

export function HeatMeter({ temperature }: { temperature: Temperature }) {
  const level = TEMPERATURES[temperature].level;
  return (
    <span className="heat" title={`Temperature: ${TEMPERATURES[temperature].label}`} aria-hidden="true">
      {[1, 2, 3].map(i => <i key={i} className={i <= level ? `on h${level}` : ''} />)}
    </span>
  );
}
