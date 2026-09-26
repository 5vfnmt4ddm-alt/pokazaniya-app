import { useEffect, useMemo, useState } from "react";
import { History, Settings2 } from "lucide-react";
import { format } from "date-fns";
import { ru } from "date-fns/locale";
import { Button } from "@/components/ui/button";
import { ElectricMeter } from "@/components/meters/electric-meter";
import { WaterMeter } from "@/components/meters/water-meter";
import { KeypadDrawer } from "@/components/keypad-drawer";
import { SettingsDrawer } from "@/components/settings-drawer";
import { HistoryDrawer } from "@/components/history-drawer";
import { ReceiptView } from "@/components/receipt-view";
import {
  computeReceipt,
  formatReading,
  METER_META,
  type MeterKey,
  type Receipt,
} from "@/lib/calc";
import { useMeterStore } from "@/lib/store";
import { getTelegram, haptic, initTelegram, isInsideTelegram } from "@/lib/telegram";
import { cn } from "@/lib/utils";

const SERIAL = {
  hot: "1011051599503",
  cold: "1011052063508",
} as const;

export function AppHome() {
  const current = useMeterStore((s) => s.current);
  const previous = useMeterStore((s) => s.previous);
  const tariffs = useMeterStore((s) => s.tariffs);
  const setCurrent = useMeterStore((s) => s.setCurrent);
  const commitReceipt = useMeterStore((s) => s.commitReceipt);

  const [tab, setTab] = useState<"water" | "elec">("water");
  const [editKey, setEditKey] = useState<MeterKey | null>(null);
  const [keypadOpen, setKeypadOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [receipt, setReceipt] = useState<Receipt | null>(null);
  const [errors, setErrors] = useState<string[]>([]);

  useEffect(() => {
    void useMeterStore.persist.rehydrate();
    initTelegram();
  }, []);

  const month = useMemo(
    () => format(new Date(), "LLLL yyyy", { locale: ru }),
    [],
  );

  function openMeter(key: MeterKey) {
    haptic("light");
    setEditKey(key);
    setKeypadOpen(true);
  }

  function calculate() {
    const result = computeReceipt(current, previous, tariffs);
    if (result.errors.length || !result.receipt) {
      haptic("error");
      setErrors(result.errors);
      return;
    }
    haptic("success");
    setErrors([]);
    setReceipt(result.receipt);
  }

  function saveReceipt() {
    if (!receipt) return;
    commitReceipt(receipt);
    setReceipt(null);
  }

  function sendToBot() {
    if (!receipt) return;
    const wa = getTelegram();
    commitReceipt(receipt);
    if (wa && isInsideTelegram()) {
      wa.sendData(
        JSON.stringify({
          hot: receipt.current.hot,
          cold: receipt.current.cold,
          t1: receipt.current.t1,
          t2: receipt.current.t2,
          t3: receipt.current.t3,
          use: receipt.use,
          cost_elec: receipt.costElec,
          cost_water: receipt.costWater,
          total: receipt.total,
          date: receipt.date,
        }),
      );
    }
    setReceipt(null);
  }

  useEffect(() => {
    const wa = getTelegram();
    if (!wa?.MainButton) return;
    const handler = () => {
      if (receipt) sendToBot();
      else calculate();
    };
    wa.MainButton.setText(receipt ? "Отправить в чат" : "Рассчитать");
    wa.MainButton.show();
    wa.MainButton.onClick(handler);
    return () => {
      wa.MainButton?.offClick(handler);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [receipt, current, previous, tariffs]);

  if (receipt) {
    return (
      <div className="min-h-dvh">
        <ReceiptView
          receipt={receipt}
          onBack={() => setReceipt(null)}
          onSave={saveReceipt}
          onSend={sendToBot}
        />
      </div>
    );
  }

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-lg flex-col md:max-w-5xl">
      <header className="sticky top-0 z-20 border-b border-border/70 bg-bg/85 px-4 pb-3 pt-[max(0.9rem,env(safe-area-inset-top))] backdrop-blur-sm">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-muted">
              Коммунальный учёт
            </p>
            <h1 className="mt-0.5 text-2xl font-medium tracking-tight">Показания</h1>
            <p className="mt-0.5 text-sm text-muted">{month}</p>
          </div>
          <div className="flex gap-1">
            <Button variant="ghost" size="icon" aria-label="История" onClick={() => setHistoryOpen(true)}>
              <History className="size-5" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              aria-label="Настройки"
              onClick={() => setSettingsOpen(true)}
            >
              <Settings2 className="size-5" />
            </Button>
          </div>
        </div>
        <div className="mt-3 flex gap-1.5 overflow-x-auto pb-0.5 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {(["hot", "cold", "t1", "t2", "t3"] as MeterKey[]).map((key) => (
            <button
              key={key}
              type="button"
              className="summary-chip"
              onClick={() => openMeter(key)}
            >
              {METER_META[key].short} {formatReading(current[key], METER_META[key].decimals)}
            </button>
          ))}
        </div>
      </header>

      <div className="px-4 pt-4 md:hidden">
        <div className="grid grid-cols-2 rounded-full bg-surface p-1">
          <button
            type="button"
            className={cn(
              "h-10 rounded-full text-sm font-medium transition-colors duration-[var(--motion-quick)]",
              tab === "water" ? "bg-surface-2 text-fg shadow-sm" : "text-muted",
            )}
            onClick={() => setTab("water")}
          >
            Вода
          </button>
          <button
            type="button"
            className={cn(
              "h-10 rounded-full text-sm font-medium transition-colors duration-[var(--motion-quick)]",
              tab === "elec" ? "bg-surface-2 text-fg shadow-sm" : "text-muted",
            )}
            onClick={() => setTab("elec")}
          >
            Электричество
          </button>
        </div>
      </div>

      <main className="flex-1 px-4 pb-32 pt-5">
        <div className="md:grid md:grid-cols-2 md:items-start md:gap-10">
          <div className={cn("flex flex-col gap-10", tab !== "water" && "hidden md:flex")}>
            <WaterMeter
              kind="hot"
              value={current.hot}
              previous={previous.hot}
              serial={SERIAL.hot}
              onOpen={() => openMeter("hot")}
            />
            <WaterMeter
              kind="cold"
              value={current.cold}
              previous={previous.cold}
              serial={SERIAL.cold}
              onOpen={() => openMeter("cold")}
            />
          </div>
          <div className={cn("flex flex-col gap-5", tab !== "elec" && "hidden md:flex")}>
            <ElectricMeter
              tariff="T1"
              value={current.t1}
              previous={previous.t1}
              onOpen={() => openMeter("t1")}
            />
            <ElectricMeter
              tariff="T2"
              value={current.t2}
              previous={previous.t2}
              onOpen={() => openMeter("t2")}
            />
            <ElectricMeter
              tariff="T3"
              value={current.t3}
              previous={previous.t3}
              onOpen={() => openMeter("t3")}
            />
          </div>
        </div>
        {errors.length ? (
          <div className="mt-6 rounded-2xl border border-hot/30 bg-hot/10 px-4 py-3 text-sm text-hot">
            <p className="font-medium">Новые показания меньше предыдущих</p>
            <ul className="mt-1 space-y-0.5">
              {errors.map((e) => (
                <li key={e}>{e}</li>
              ))}
            </ul>
          </div>
        ) : null}
      </main>

      <div className="pointer-events-none sticky bottom-0 z-20 bg-gradient-to-t from-bg via-bg to-transparent px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-6">
        <Button size="lg" className="pointer-events-auto w-full" onClick={calculate}>
          Рассчитать
        </Button>
      </div>

      <KeypadDrawer
        meter={editKey}
        value={editKey ? current[editKey] : 0}
        previous={editKey ? previous[editKey] : 0}
        open={keypadOpen}
        onOpenChange={setKeypadOpen}
        onCommit={(v) => {
          if (editKey) setCurrent(editKey, v);
        }}
      />
      <SettingsDrawer open={settingsOpen} onOpenChange={setSettingsOpen} />
      <HistoryDrawer open={historyOpen} onOpenChange={setHistoryOpen} />
    </div>
  );
}
