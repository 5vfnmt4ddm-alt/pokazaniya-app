export type TelegramWebApp = {
  ready: () => void;
  expand: () => void;
  close: () => void;
  initData: string;
  colorScheme?: "light" | "dark";
  isExpanded?: boolean;
  enableClosingConfirmation?: () => void;
  disableClosingConfirmation?: () => void;
  sendData: (data: string) => void;
  HapticFeedback?: {
    impactOccurred: (style: "light" | "medium" | "heavy" | "rigid" | "soft") => void;
    notificationOccurred: (type: "error" | "success" | "warning") => void;
  };
  MainButton?: {
    text: string;
    isVisible: boolean;
    show: () => void;
    hide: () => void;
    setText: (text: string) => void;
    onClick: (fn: () => void) => void;
    offClick: (fn: () => void) => void;
    enable: () => void;
    disable: () => void;
    showProgress: (leaveActive?: boolean) => void;
    hideProgress: () => void;
    setParams: (params: { color?: string; text_color?: string; is_active?: boolean; is_visible?: boolean }) => void;
  };
};

declare global {
  interface Window {
    Telegram?: { WebApp?: TelegramWebApp };
  }
}

export function getTelegram(): TelegramWebApp | null {
  if (typeof window === "undefined") return null;
  const wa = window.Telegram?.WebApp;
  if (!wa) return null;
  if (!wa.initData && !wa.MainButton) return wa;
  return wa;
}

export function isInsideTelegram(): boolean {
  const wa = getTelegram();
  return Boolean(wa && wa.initData);
}

export function haptic(kind: "light" | "success" | "error" | "warning" = "light") {
  const hf = getTelegram()?.HapticFeedback;
  if (!hf) return;
  try {
    if (kind === "light") hf.impactOccurred("light");
    else hf.notificationOccurred(kind);
  } catch {
    /* optional */
  }
}

export function initTelegram() {
  const wa = getTelegram();
  if (!wa) return;
  try {
    wa.ready();
    wa.expand();
    wa.enableClosingConfirmation?.();
  } catch {
    /* optional */
  }
}
