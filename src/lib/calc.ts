export type Readings = {
  hot: number;
  cold: number;
  t1: number;
  t2: number;
  t3: number;
};

export type Tariffs = {
  elec_t1: number;
  elec_t2: number;
  elec_t3: number;
  water_cold: number;
  water_hot: number;
};

export type MeterKey = keyof Readings;

export type Usage = Readings;

export type Receipt = {
  date: string;
  current: Readings;
  previous: Readings;
  use: Usage;
  costElec: number;
  costWater: number;
  total: number;
};

export const METER_META: Record<
  MeterKey,
  { label: string; short: string; unit: string; kind: "water" | "elec"; decimals: number }
> = {
  hot: { label: "Горячая вода", short: "ГВС", unit: "м³", kind: "water", decimals: 3 },
  cold: { label: "Холодная вода", short: "ХВС", unit: "м³", kind: "water", decimals: 3 },
  t1: { label: "Электричество Т1", short: "Т1", unit: "кВт·ч", kind: "elec", decimals: 2 },
  t2: { label: "Электричество Т2", short: "Т2", unit: "кВт·ч", kind: "elec", decimals: 2 },
  t3: { label: "Электричество Т3", short: "Т3", unit: "кВт·ч", kind: "elec", decimals: 2 },
};

export const DEFAULT_TARIFFS: Tariffs = {
  elec_t1: 7.1,
  elec_t2: 2.82,
  elec_t3: 5.8,
  water_cold: 45.2,
  water_hot: 150,
};

export const DEFAULT_PREVIOUS: Readings = {
  hot: 22.081,
  cold: 48.256,
  t1: 348.79,
  t2: 192.14,
  t3: 87.53,
};

export const WATER_INT = 5;
export const WATER_FRAC = 3;
export const ELEC_INT = 5;
export const ELEC_FRAC = 2;

export function clampReading(value: number, decimals: number): number {
  const maxInt = decimals === 3 ? 99_999.999 : 99_999.99;
  const n = Number.isFinite(value) ? value : 0;
  const clamped = Math.min(maxInt, Math.max(0, n));
  return Number(clamped.toFixed(decimals));
}

export function splitDigits(
  value: number,
  intLen: number,
  fracLen: number,
): { intDigits: number[]; fracDigits: number[] } {
  const fixed = clampReading(value, fracLen).toFixed(fracLen);
  const [iRaw, fRaw = ""] = fixed.split(".");
  const intDigits = iRaw.padStart(intLen, "0").slice(-intLen).split("").map(Number);
  const fracDigits = fRaw.padEnd(fracLen, "0").slice(0, fracLen).split("").map(Number);
  return { intDigits, fracDigits };
}

export function splitLcdDigits(
  value: number,
  intLen: number,
  fracLen: number,
): { intDigits: Array<number | null>; fracDigits: number[] } {
  const { intDigits, fracDigits } = splitDigits(value, intLen, fracLen);
  let leading = true;
  const display = intDigits.map((d, idx) => {
    if (leading && d === 0 && idx < intDigits.length - 1) return null;
    leading = false;
    return d;
  });
  return { intDigits: display, fracDigits };
}

export function formatReading(value: number, decimals: number): string {
  return clampReading(value, decimals).toFixed(decimals).replace(".", ",");
}

export function formatMoney(value: number): string {
  return (
    value.toLocaleString("ru-RU", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }) + " ₽"
  );
}

export function parseReading(input: string, decimals: number): number | null {
  const normalized = input.trim().replace(/\s/g, "").replace(",", ".");
  if (!normalized) return null;
  const n = Number(normalized);
  if (!Number.isFinite(n)) return null;
  return clampReading(n, decimals);
}

const LABELS: Record<MeterKey, string> = {
  hot: "Горячая",
  cold: "Холодная",
  t1: "Т1",
  t2: "Т2",
  t3: "Т3",
};

export function validateReadings(current: Readings, previous: Readings): string[] {
  const keys: MeterKey[] = ["t1", "t2", "t3", "cold", "hot"];
  const errors: string[] = [];
  for (const key of keys) {
    if (current[key] < previous[key]) {
      errors.push(
        `${LABELS[key]}: ${formatReading(current[key], METER_META[key].decimals)} меньше прошлых ${formatReading(previous[key], METER_META[key].decimals)}`,
      );
    }
  }
  return errors;
}

export function computeReceipt(
  current: Readings,
  previous: Readings,
  tariffs: Tariffs,
  date = new Date(),
): { errors: string[]; receipt: Receipt | null } {
  const errors = validateReadings(current, previous);
  if (errors.length) return { errors, receipt: null };

  const use: Usage = {
    t1: current.t1 - previous.t1,
    t2: current.t2 - previous.t2,
    t3: current.t3 - previous.t3,
    cold: current.cold - previous.cold,
    hot: current.hot - previous.hot,
  };

  const costElec =
    use.t1 * tariffs.elec_t1 + use.t2 * tariffs.elec_t2 + use.t3 * tariffs.elec_t3;
  const costWater = use.cold * tariffs.water_cold + use.hot * tariffs.water_hot;

  const receipt: Receipt = {
    date: date.toLocaleDateString("ru-RU"),
    current: { ...current },
    previous: { ...previous },
    use,
    costElec,
    costWater,
    total: costElec + costWater,
  };

  return { errors: [], receipt };
}

export function receiptToCsv(rows: Receipt[]): string {
  const header = [
    "Дата",
    "Расход T1",
    "Расход T2",
    "Расход T3",
    "Расход ХВС",
    "Расход ГВС",
    "Сумма свет",
    "Сумма вода",
    "Итого",
  ];
  const lines = [header.join(";")];
  for (const r of rows) {
    lines.push(
      [
        r.date,
        r.use.t1.toFixed(2),
        r.use.t2.toFixed(2),
        r.use.t3.toFixed(2),
        r.use.cold.toFixed(3),
        r.use.hot.toFixed(3),
        r.costElec.toFixed(2),
        r.costWater.toFixed(2),
        r.total.toFixed(2),
      ].join(";"),
    );
  }
  return "\uFEFF" + lines.join("\n");
}
