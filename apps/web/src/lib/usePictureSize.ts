import { useEffect, useState, type RefObject } from 'react';

/**
 * The real pixel size of the picture shown inside `ref`: her AI picture once it has faded in, otherwise
 * what she painted on this device. Checks twice a second (the AI picture can arrive a minute later).
 */
export function usePictureSize(ref: RefObject<HTMLElement>, on = true) {
  const [size, setSize] = useState<{ w: number; h: number } | null>(null);
  useEffect(() => {
    if (!on) return;
    let last = '';
    const look = () => {
      const box = ref.current;
      if (!box) return;
      const ai = box.querySelector<HTMLImageElement>('img.pic-in');
      const el = ai && ai.complete && ai.naturalWidth ? ai : box.querySelector<HTMLCanvasElement | HTMLImageElement>('canvas, img');
      // A crisper copy is enlarged on this device: its own pixels are what count for printing.
      const own = el instanceof HTMLImageElement && el.dataset.sourceW ? { w: Number(el.dataset.sourceW), h: Number(el.dataset.sourceH) } : null;
      const w = own?.w ?? (el instanceof HTMLCanvasElement ? el.width : el?.naturalWidth ?? 0);
      const h = own?.h ?? (el instanceof HTMLCanvasElement ? el.height : el?.naturalHeight ?? 0);
      if (w && h && `${w}x${h}` !== last) { last = `${w}x${h}`; setSize({ w, h }); }
    };
    look();
    const t = window.setInterval(look, 500);
    const stop = window.setTimeout(() => window.clearInterval(t), 120_000);
    return () => { window.clearInterval(t); window.clearTimeout(stop); };
  }, [ref, on]);
  return size;
}
