import { Drawer } from "vaul";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { METER_META, formatReading, parseReading, type MeterKey, type Tariffs } from "@/lib/calc";
import { useMeterStore } from "@/lib/store";

const TARIFF_META: { key: keyof Tariffs; label: string }[] = [
  { key: "elec_t1", label: "Электричество Т1, ₽/кВт·ч" },
  { key: "elec_t2", label: "Электричество Т2, ₽/кВт·ч" },
  { key: "elec_t3", label: "Электричество Т3, ₽/кВт·ч" },
  { key: "water_hot", label: "Горячая вода, ₽/м³" },
  { key: "water_cold", label: "Холодная вода, ₽/м³" },
];

const ORDER: MeterKey[] = ["hot", "cold", "t1", "t2", "t3"];

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function SettingsDrawer({ open, onOpenChange }: Props) {
  const previous = useMeterStore((s) => s.previous);
  const tariffs = useMeterStore((s) => s.tariffs);
  const setPrevious = useMeterStore((s) => s.setPrevious);
  const setTariff = useMeterStore((s) => s.setTariff);
  const snapshotAsInitial = useMeterStore((s) => s.snapshotAsInitial);
  const resetAll = useMeterStore((s) => s.resetAll);

  return (
    <Drawer.Root open={open} onOpenChange={onOpenChange}>
      <Drawer.Portal>
        <Drawer.Overlay className="fixed inset-0 z-40 bg-fg/40" />
        <Drawer.Content className="fixed inset-x-0 bottom-0 z-50 mx-auto flex max-h-[92vh] max-w-lg flex-col rounded-t-[28px] bg-surface outline-none">
          <div className="mx-auto mt-3 h-1 w-10 shrink-0 rounded-full bg-border" />
          <div className="overflow-y-auto px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-4">
            <Drawer.Title className="text-base font-medium">Настройки</Drawer.Title>
            <Drawer.Description className="mt-1 text-sm text-muted">
              Начальные показания, тарифы и код бота.
            </Drawer.Description>

            <h3 className="mt-6 text-xs font-medium uppercase tracking-[0.14em] text-muted">
              Прошлые показания
            </h3>
            <div className="mt-3 grid gap-3">
              {ORDER.map((key) => (
                <div key={key} className="grid gap-1.5">
                  <Label htmlFor={`prev-${key}`}>
                    {METER_META[key].label}, {METER_META[key].unit}
                  </Label>
                  <Input
                    id={`prev-${key}`}
                    inputMode="decimal"
                    defaultValue={formatReading(previous[key], METER_META[key].decimals)}
                    key={`${key}-${previous[key]}`}
                    onBlur={(e) => {
                      const n = parseReading(e.target.value, METER_META[key].decimals);
                      if (n !== null) setPrevious(key, n);
                    }}
                  />
                </div>
              ))}
            </div>
            <Button
              variant="secondary"
              className="mt-3 w-full"
              onClick={() => snapshotAsInitial()}
            >
              Взять текущие как начальные
            </Button>

            <h3 className="mt-8 text-xs font-medium uppercase tracking-[0.14em] text-muted">
              Тарифы
            </h3>
            <div className="mt-3 grid gap-3">
              {TARIFF_META.map((row) => (
                <div key={row.key} className="grid gap-1.5">
                  <Label htmlFor={`tar-${row.key}`}>{row.label}</Label>
                  <Input
                    id={`tar-${row.key}`}
                    inputMode="decimal"
                    defaultValue={tariffs[row.key].toFixed(2).replace(".", ",")}
                    key={`${row.key}-${tariffs[row.key]}`}
                    onBlur={(e) => {
                      const n = parseReading(e.target.value, 2);
                      if (n !== null) setTariff(row.key, n);
                    }}
                  />
                </div>
              ))}
            </div>

            <h3 className="mt-8 text-xs font-medium uppercase tracking-[0.14em] text-muted">
              Telegram-бот
            </h3>
            <p className="mt-2 text-sm leading-relaxed text-muted">
              Это мини-приложение. Подключите его к боту: скачайте{" "}
              <code className="font-mono text-fg">bot.py</code>, укажите токен и URL приложения.
            </p>
            <a
              href="/bot.py"
              download="bot.py"
              className="mt-3 inline-flex h-11 w-full items-center justify-center rounded-md border border-border bg-surface-2 text-sm font-medium"
            >
              Скачать bot.py
            </a>
            <pre className="mt-3 overflow-x-auto rounded-xl bg-primary p-3 font-mono text-[11px] leading-relaxed text-primary-fg">
{`TELEGRAM_BOT_TOKEN=...
MINIAPP_URL=https://ваш-адрес/
ADMIN_IDS=528656263`}
            </pre>

            <Button variant="outline" className="mt-8 w-full" onClick={() => resetAll()}>
              Сбросить все данные
            </Button>
          </div>
        </Drawer.Content>
      </Drawer.Portal>
    </Drawer.Root>
  );
}
