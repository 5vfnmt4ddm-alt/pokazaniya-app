const MAP: Record<string, string> = {
  "0": "abcdef",
  "1": "bc",
  "2": "abdeg",
  "3": "abcdg",
  "4": "bcfg",
  "5": "acdfg",
  "6": "acdefg",
  "7": "abc",
  "8": "abcdefg",
  "9": "abcdfg",
};

const PARTS = ["a", "b", "c", "d", "e", "f", "g"] as const;

export function SevenSeg({ digit }: { digit: number | null }) {
  const on = digit === null ? "" : (MAP[String(digit)] ?? "");
  return (
    <span className="seg" aria-hidden="true">
      {PARTS.map((p) => (
        <span key={p} className={`seg-${p}${on.includes(p) ? " is-on" : ""}`} />
      ))}
    </span>
  );
}
