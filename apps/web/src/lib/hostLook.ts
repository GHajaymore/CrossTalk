import { useEffect, useState } from 'react';

// How the hosts appear on screen, on this device: as living voice cards (the default, owner's call,
// Oct 11, 2026: nothing on screen pretends to be a person), or as their AI photos.
export type HostLook = 'voice' | 'photo';
const KEY = 'ct_host_look';
const EVENT = 'ct-host-look';

export function hostLook(): HostLook {
  try { return localStorage.getItem(KEY) === 'photo' ? 'photo' : 'voice'; } catch { return 'voice'; }
}
export function setHostLook(l: HostLook) {
  try { localStorage.setItem(KEY, l); } catch { /* storage blocked: this visit only */ }
  window.dispatchEvent(new CustomEvent(EVENT, { detail: l }));
}
export function useHostLook(): HostLook {
  const [l, setL] = useState<HostLook>(hostLook);
  useEffect(() => {
    const on = (e: Event) => setL((e as CustomEvent<HostLook>).detail ?? hostLook());
    window.addEventListener(EVENT, on);
    return () => window.removeEventListener(EVENT, on);
  }, []);
  return l;
}
