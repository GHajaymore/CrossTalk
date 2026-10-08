import { NOTICE } from '@crosstalk/shared';

export function Footer() {
  return (
    <div className="notice">
      <span>{NOTICE}</span>
      <span>Mock mode: all speech is scripted sample text.</span>
    </div>
  );
}
