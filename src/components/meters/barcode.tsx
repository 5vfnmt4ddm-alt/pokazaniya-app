export function MeterBarcode({ serial }: { serial: string }) {
  const bars = Array.from(serial).flatMap((ch, i) => {
    const n = ch.charCodeAt(0) + i * 7;
    return [1 + (n % 3), 1 + ((n * 3) % 2)];
  });
  let x = 0;
  const rects = bars.map((w, i) => {
    const el = i % 2 === 0 ? { x, w, key: i } : null;
    x += w + 1;
    return el;
  });
  return (
    <svg viewBox={`0 0 ${x} 20`} role="img" aria-label={`Штрихкод ${serial}`}>
      {rects.map((r) =>
        r ? <rect key={r.key} x={r.x} y="0" width={r.w} height="20" /> : null,
      )}
    </svg>
  );
}
