import { ArrowLeft, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatMoney, formatReading, type Receipt } from "@/lib/calc";
import { isInsideTelegram } from "@/lib/telegram";

type Props = {
  receipt: Receipt;
  onBack: () => void;
  onSave: () => void;
  onSend: () => void;
};

export function ReceiptView({ receipt, onBack, onSave, onSend }: Props) {
  const tg = isInsideTelegram();

  return (
    <section className="mx-auto w-full max-w-lg px-4 pb-28 pt-4">
      <button
        type="button"
        onClick={onBack}
        className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted"
      >
        <ArrowLeft className="size-4" />
        К счётчикам
      </button>
      <div className="rounded-[28px] border border-border bg-surface-2 p-5 shadow-sm">
        <p className="text-xs font-medium uppercase tracking-[0.16em] text-muted">Квитанция</p>
        <h2 className="mt-1 text-xl font-medium tracking-tight">Расчёт за {receipt.date}</h2>
        <div className="mt-5 space-y-4">
          <div>
            <p className="text-xs font-medium uppercase tracking-[0.14em] text-muted">Электричество</p>
            <ul className="mt-2 space-y-1 text-sm">
              <li className="flex justify-between font-mono tabular-nums">
                <span>Т1</span>
                <span>{formatReading(receipt.use.t1, 1)} кВт·ч</span>
              </li>
              <li className="flex justify-between font-mono tabular-nums">
                <span>Т2</span>
                <span>{formatReading(receipt.use.t2, 1)} кВт·ч</span>
              </li>
              <li className="flex justify-between font-mono tabular-nums">
                <span>Т3</span>
                <span>{formatReading(receipt.use.t3, 1)} кВт·ч</span>
              </li>
            </ul>
            <p className="mt-2 flex justify-between text-sm">
              <span className="text-muted">Сумма за свет</span>
              <span className="font-medium tabular-nums">{formatMoney(receipt.costElec)}</span>
            </p>
          </div>
          <div className="h-px bg-border" />
          <div>
            <p className="text-xs font-medium uppercase tracking-[0.14em] text-muted">Вода</p>
            <ul className="mt-2 space-y-1 text-sm">
              <li className="flex justify-between font-mono tabular-nums">
                <span>Горячая</span>
                <span>{formatReading(receipt.use.hot, 1)} м³</span>
              </li>
              <li className="flex justify-between font-mono tabular-nums">
                <span>Холодная</span>
                <span>{formatReading(receipt.use.cold, 1)} м³</span>
              </li>
            </ul>
            <p className="mt-2 flex justify-between text-sm">
              <span className="text-muted">Сумма за воду</span>
              <span className="font-medium tabular-nums">{formatMoney(receipt.costWater)}</span>
            </p>
          </div>
          <div className="h-px bg-border" />
          <p className="flex items-baseline justify-between">
            <span className="text-sm font-medium">Итого к оплате</span>
            <span className="font-mono text-2xl font-medium tabular-nums tracking-tight">
              {formatMoney(receipt.total)}
            </span>
          </p>
        </div>
      </div>
      <div className="mt-4 flex flex-col gap-2">
        <Button size="lg" className="w-full" onClick={onSave}>
          Сохранить и зафиксировать
        </Button>
        {tg ? (
          <Button size="lg" variant="secondary" className="w-full" onClick={onSend}>
            <Send className="size-4" />
            Отправить в чат бота
          </Button>
        ) : null}
      </div>
      <p className="mt-3 text-center text-xs text-muted">
        После сохранения текущие станут прошлыми для следующего месяца.
      </p>
    </section>
  );
}
