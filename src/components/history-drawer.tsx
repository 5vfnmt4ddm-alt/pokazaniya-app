import { Drawer } from "vaul";
import { Button } from "@/components/ui/button";
import { formatMoney, formatReading, receiptToCsv } from "@/lib/calc";
import { useMeterStore } from "@/lib/store";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function HistoryDrawer({ open, onOpenChange }: Props) {
  const history = useMeterStore((s) => s.history);
  const clearHistory = useMeterStore((s) => s.clearHistory);

  function downloadCsv() {
    const blob = new Blob([receiptToCsv(history)], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "pokazaniya-history.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <Drawer.Root open={open} onOpenChange={onOpenChange}>
      <Drawer.Portal>
        <Drawer.Overlay className="fixed inset-0 z-40 bg-fg/40" />
        <Drawer.Content className="fixed inset-x-0 bottom-0 z-50 mx-auto flex max-h-[92vh] max-w-lg flex-col rounded-t-[28px] bg-surface outline-none">
          <div className="mx-auto mt-3 h-1 w-10 shrink-0 rounded-full bg-border" />
          <div className="overflow-y-auto px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-4">
            <Drawer.Title className="text-base font-medium">История расчётов</Drawer.Title>
            <Drawer.Description className="mt-1 text-sm text-muted">
              Последние квитанции на этом устройстве.
            </Drawer.Description>
            {history.length === 0 ? (
              <p className="mt-8 text-sm text-muted">Пока пусто — сначала посчитайте месяц.</p>
            ) : (
              <ul className="mt-4 space-y-3">
                {history.map((row, i) => (
                  <li
                    key={`${row.date}-${i}`}
                    className="rounded-2xl border border-border bg-surface-2 p-4"
                  >
                    <div className="flex items-baseline justify-between gap-3">
                      <span className="text-sm font-medium">{row.date}</span>
                      <span className="font-mono text-sm tabular-nums">{formatMoney(row.total)}</span>
                    </div>
                    <p className="mt-2 text-xs text-muted">
                      ГВС {formatReading(row.use.hot, 1)} · ХВС {formatReading(row.use.cold, 1)} · Т1{" "}
                      {formatReading(row.use.t1, 1)} · Т2 {formatReading(row.use.t2, 1)} · Т3{" "}
                      {formatReading(row.use.t3, 1)}
                    </p>
                  </li>
                ))}
              </ul>
            )}
            <div className="mt-4 flex gap-2">
              <Button
                variant="secondary"
                className="flex-1"
                disabled={!history.length}
                onClick={downloadCsv}
              >
                Скачать CSV
              </Button>
              <Button
                variant="outline"
                className="flex-1"
                disabled={!history.length}
                onClick={() => clearHistory()}
              >
                Очистить
              </Button>
            </div>
          </div>
        </Drawer.Content>
      </Drawer.Portal>
    </Drawer.Root>
  );
}
