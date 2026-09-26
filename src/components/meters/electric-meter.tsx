import { ELEC_FRAC, ELEC_INT, formatReading, splitLcdDigits } from "@/lib/calc";
import { SevenSeg } from "./seven-seg";

type Props = {
  tariff: "T1" | "T2" | "T3";
  value: number;
  previous: number;
  onOpen: () => void;
};

export function ElectricMeter({ tariff, value, previous, onOpen }: Props) {
  const { intDigits, fracDigits } = splitLcdDigits(value, ELEC_INT, ELEC_FRAC);
  const below = value < previous;

  return (
    <article className="relative">
      <div className="elec-meter">
        <div className="elec-bezel">
          <div className="elec-lcd">
            <span className="elec-tariff">{tariff}</span>
            <span className="elec-unit">кВт·ч</span>
            <div className="elec-lcd-grid" />
            <div className="elec-lcd-row" aria-hidden="true">
              {intDigits.map((d, i) => (
                <SevenSeg key={`i${i}`} digit={d} />
              ))}
              <span className="seg-comma" />
              {fracDigits.map((d, i) => (
                <SevenSeg key={`f${i}`} digit={d} />
              ))}
            </div>
          </div>
          <span className="elec-led" aria-hidden="true" />
        </div>
        <div className="elec-meta">
          <div>
            <div className="elec-brand">Меркурий 200.02</div>
            <div className="elec-sub">230 В · 5(60) А · 50 Гц</div>
          </div>
          <div className="elec-serial">
            № 46206583-22
            <div>ГОСТ 31818.11</div>
          </div>
        </div>
        <div className="elec-stickers">
          <span className="elec-sticker">Изготовитель ООО «НПФ МОССАР»</span>
          <span className="elec-sticker elec-sticker-seal">Опломбировано АО «Мосэнергосбыт»</span>
        </div>
        <button
          type="button"
          className="elec-tap"
          onClick={onOpen}
          aria-label={`Электричество ${tariff}`}
        >
          <span className="sr-only">
            {tariff} {formatReading(value, ELEC_FRAC)} киловатт-часов
          </span>
        </button>
      </div>
      <p className="mt-2 text-center text-xs text-muted">
        Текущие{" "}
        <span className="font-mono text-fg tabular-nums">{formatReading(value, ELEC_FRAC)}</span>
        {" кВт·ч"}
        <span className="mx-1.5 text-border">·</span>
        прошлые <span className="font-mono tabular-nums">{formatReading(previous, ELEC_FRAC)}</span>
        {below ? <span className="ml-2 font-medium text-hot">меньше прошлых</span> : null}
      </p>
    </article>
  );
}
