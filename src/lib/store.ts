import { create } from "zustand";
import { persist } from "zustand/middleware";
import {
  DEFAULT_PREVIOUS,
  DEFAULT_TARIFFS,
  type MeterKey,
  type Readings,
  type Receipt,
  type Tariffs,
  clampReading,
  METER_META,
} from "./calc";

type MeterState = {
  current: Readings;
  previous: Readings;
  tariffs: Tariffs;
  history: Receipt[];
  setCurrent: (key: MeterKey, value: number) => void;
  setPrevious: (key: MeterKey, value: number) => void;
  setTariff: (key: keyof Tariffs, value: number) => void;
  snapshotAsInitial: () => void;
  commitReceipt: (receipt: Receipt) => void;
  clearHistory: () => void;
  resetAll: () => void;
};

export const useMeterStore = create<MeterState>()(
  persist(
    (set) => ({
      current: { ...DEFAULT_PREVIOUS },
      previous: { ...DEFAULT_PREVIOUS },
      tariffs: { ...DEFAULT_TARIFFS },
      history: [],
      setCurrent: (key, value) =>
        set((s) => ({
          current: { ...s.current, [key]: clampReading(value, METER_META[key].decimals) },
        })),
      setPrevious: (key, value) =>
        set((s) => ({
          previous: { ...s.previous, [key]: clampReading(value, METER_META[key].decimals) },
        })),
      setTariff: (key, value) =>
        set((s) => ({
          tariffs: { ...s.tariffs, [key]: Math.max(0, Number(value.toFixed(2))) },
        })),
      snapshotAsInitial: () =>
        set((s) => ({
          previous: { ...s.current },
        })),
      commitReceipt: (receipt) =>
        set((s) => ({
          previous: { ...receipt.current },
          current: { ...receipt.current },
          history: [receipt, ...s.history].slice(0, 36),
        })),
      clearHistory: () => set({ history: [] }),
      resetAll: () =>
        set({
          current: { ...DEFAULT_PREVIOUS },
          previous: { ...DEFAULT_PREVIOUS },
          tariffs: { ...DEFAULT_TARIFFS },
          history: [],
        }),
    }),
    { name: "pokazaniya-v1", skipHydration: true },
  ),
);
