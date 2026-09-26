import { useEffect, useState } from "react";
import { Drawer } from "vaul";
import { Delete, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { METER_META, type MeterKey, formatReading, parseReading } from "@/lib/calc";
import { haptic } from "@/lib/telegram";
import { cn } from "@/lib/utils";

const KEYS = ["1", "2", "3", "4", "5", "6", "7", "8", "9", ",", "0", "back"] as const;

type Props = {
  meter: MeterKey | null;
  value: number;
  previous: number;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCommit: (value: number) => void;
};

export function KeypadDrawer({ meter, value, previous, open, onOpenChange, onCommit }: Props) {
  const meta = meter ? METER_META[meter] : null;
  const [draft, setDraft] = useState("");
  /** После открытия первое нажатие цифры/запятой заменяет старое значение. */
  const [replaceOnType, setReplaceOnType] = useState(true);

  useEffect(() => {
    if (open && meta) {
      setDraft(formatReading(value, meta.decimals));
      setReplaceOnType(true);
    }
  }, [open, meter, value, meta]);

  if (!meta || !meter) return null;

  const decimals = meta.decimals;

  function typeKey(key: (typeof KEYS)[number]) {
    haptic("light");

    if (key === "back") {
      setReplaceOnType(false);
      setDraft((prev) => prev.slice(0, -1));
      return;
    }

    setDraft((prev) => {
      const base = replaceOnType ? "" : prev;

      if (key === ",") {
        if (base.includes(",") || base.includes(".")) return base || "0,";
        return base.length ? base + "," : "0,";
      }

      const next = (base === "0" ? "" : base) + key;
      const [intPart = "", frac = ""] = next.replace(".", ",").split(",");
      if (intPart.replace(/^0+/, "").length > 5 && intPart !== "0") return base;
      if (frac.length > decimals) return base;
      return next;
    });
    setReplaceOnType(false);
  }

  function confirm() {
    const parsed = parseReading(draft || "0", decimals);
    if (parsed === null) return;
    if (parsed < previous) {
      haptic("error");
      return;
    }
    haptic("success");
    onCommit(parsed);
    onOpenChange(false);
  }

  const parsed = parseReading(draft || "0", decimals) ?? 0;
  const below = parsed < previous;

  return (
    <Drawer.Root open={open} onOpenChange={onOpenChange}>
      <Drawer.Portal>
        <Drawer.Overlay className="fixed inset-0 z-40 bg-fg/40" />
        <Drawer.Content className="fixed inset-x-0 bottom-0 z-50 mx-auto max-w-lg rounded-t-[28px] bg-surface outline-none">
          <div className="mx-auto mt-3 h-1 w-10 rounded-full bg-border" />
          <div className="px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-4">
            <Drawer.Title className="text-base font-medium">{meta.label}</Drawer.Title>
            <Drawer.Description className="mt-1 text-sm text-muted">
              Прошлые показания {formatReading(previous, meta.decimals)} {meta.unit}
            </Drawer.Description>
            <p
              className={cn(
                "mt-4 rounded-xl bg-surface-2 px-4 py-3 text-right font-mono text-3xl tabular-nums tracking-tight",
                below && "text-hot",
              )}
            >
              {draft || "0"}
              <span className="ml-2 text-base text-muted">{meta.unit}</span>
            </p>
            {below ? (
              <p className="mt-2 text-xs font-medium text-hot">Значение меньше предыдущего.</p>
            ) : null}
            <div className="keypad-grid mt-4">
              {KEYS.map((key) => (
                <button
                  key={key}
                  type="button"
                  className="keypad-key"
                  onClick={() => typeKey(key)}
                  aria-label={key === "back" ? "Стереть" : key}
                >
                  {key === "back" ? <Delete className="mx-auto size-5" /> : key}
                </button>
              ))}
            </div>
            <Button className="mt-4 w-full" size="lg" onClick={confirm} disabled={below}>
              <Check className="size-4" />
              Сохранить
            </Button>
          </div>
        </Drawer.Content>
      </Drawer.Portal>
    </Drawer.Root>
  );
}
