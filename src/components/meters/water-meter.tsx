import { WATER_FRAC, WATER_INT, formatReading, splitDigits } from "@/lib/calc";
import { MeterBarcode } from "./barcode";

function DigitColumn({ value, tone }: { value: number; tone: "black" | "red" }) {
  return (
    <div className={tone === "red" ? "digit-cell digit-cell-red" : "digit-cell"}>
      <div className="digit-strip" style={{ transform: `translateY(${-value * 28}px)` }}>
        {Array.from({ length: 10 }, (_, n) => (
          <span key={n}>{n}</span>
        ))}
      </div>
    </div>
  );
}

type Props = {
  kind: "hot" | "cold";
  value: number;
  previous: number;
  serial: string;
  onOpen: () => void;
};

export function WaterMeter({ kind, value, previous, serial, onOpen }: Props) {
  const { intDigits, fracDigits } = splitDigits(value, WATER_INT, WATER_FRAC);
  const isHot = kind === "hot";
  const below = value < previous;

  return (
    <article className="relative">
      <div className={isHot ? "water-badge water-badge-hot" : "water-badge water-badge-cold"}>
        {isHot ? "ГВС" : "ХВС"}
      </div>
      <div className="water-meter">
        <div className="water-meter-face">
          <div className="water-serial">
            <MeterBarcode serial={serial} />
            <span>{serial}</span>
          </div>
          <div className="water-window" aria-hidden="true">
            <div className="water-led" />
            <div className="water-digits">
              {intDigits.map((d, i) => (
                <DigitColumn key={`i${i}`} value={d} tone="black" />
              ))}
              {fracDigits.map((d, i) => (
                <DigitColumn key={`f${i}`} value={d} tone="red" />
              ))}
            </div>
          </div>
          <div className={isHot ? "water-module water-module-hot" : "water-module water-module-cold"}>
            <span className="water-module-brand">rubetek</span>
            <span className="water-module-chip">CRT750S</span>
            <span className="water-module-model">СВК 15-3-8-1 · 3 В · RF 868</span>
          </div>
          <p className="water-spec">Модель прибора учёта СВК 15-3-8-1</p>
        </div>
        <button type="button" className="water-tap" onClick={onOpen} aria-label={isHot ? "Горячая вода" : "Холодная вода"}>
          <span className="sr-only">
            {isHot ? "Горячая вода" : "Холодная вода"} {formatReading(value, WATER_FRAC)}
          </span>
        </button>
      </div>
      <p className="mt-3 text-center text-xs text-muted">
        Текущие{" "}
        <span className="font-mono text-fg tabular-nums">{formatReading(value, WATER_FRAC)}</span>
        {" м³"}
        <span className="mx-1.5 text-border">·</span>
        прошлые{" "}
        <span className="font-mono tabular-nums">{formatReading(previous, WATER_FRAC)}</span>
        {below ? <span className="ml-2 font-medium text-hot">меньше прошлых</span> : null}
      </p>
    </article>
  );
}
