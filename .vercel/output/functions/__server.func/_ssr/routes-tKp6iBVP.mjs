import { i as __toESM } from "../_runtime.mjs";
import { n as require_react } from "../_libs/@radix-ui/react-compose-refs+[...].mjs";
import { n as require_jsx_runtime } from "../_libs/radix-ui__react-context+react.mjs";
import { a as Delete, i as History, n as Settings2, o as Check, r as Send, s as ArrowLeft } from "../_libs/lucide-react.mjs";
import { n as format, t as ru } from "../_libs/date-fns.mjs";
import { u as Slot } from "../_libs/@radix-ui/react-dialog+[...].mjs";
import { n as clsx, t as cva } from "../_libs/class-variance-authority+clsx.mjs";
import { t as twMerge } from "../_libs/tailwind-merge.mjs";
import { t as Drawer } from "../_libs/vaul.mjs";
import { n as create, t as persist } from "../_libs/zustand.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/routes-tKp6iBVP.js
var import_react = /* @__PURE__ */ __toESM(require_react());
var import_jsx_runtime = require_jsx_runtime();
function cn(...inputs) {
	return twMerge(clsx(inputs));
}
var buttonVariants = cva("inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-[opacity,transform,background-color] duration-[var(--motion-quick)] ease-[var(--ease-out)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 disabled:pointer-events-none disabled:opacity-40 active:scale-[0.98] [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0", {
	variants: {
		variant: {
			default: "bg-primary text-primary-fg shadow-sm hover:opacity-90",
			secondary: "bg-surface-2 text-fg border border-border hover:bg-surface",
			outline: "border border-border bg-transparent text-fg hover:bg-surface-2",
			ghost: "text-fg hover:bg-surface-2",
			destructive: "bg-hot text-primary-fg hover:opacity-90"
		},
		size: {
			default: "h-11 px-4",
			sm: "h-9 px-3 text-xs",
			lg: "h-12 px-5",
			icon: "h-11 w-11"
		}
	},
	defaultVariants: {
		variant: "default",
		size: "default"
	}
});
var Button = import_react.forwardRef(({ className, variant, size, asChild = false, ...props }, ref) => {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(asChild ? Slot : "button", {
		className: cn(buttonVariants({
			variant,
			size,
			className
		})),
		ref,
		...props
	});
});
Button.displayName = "Button";
var METER_META = {
	hot: {
		label: "Горячая вода",
		short: "ГВС",
		unit: "м³",
		kind: "water",
		decimals: 3
	},
	cold: {
		label: "Холодная вода",
		short: "ХВС",
		unit: "м³",
		kind: "water",
		decimals: 3
	},
	t1: {
		label: "Электричество Т1",
		short: "Т1",
		unit: "кВт·ч",
		kind: "elec",
		decimals: 2
	},
	t2: {
		label: "Электричество Т2",
		short: "Т2",
		unit: "кВт·ч",
		kind: "elec",
		decimals: 2
	},
	t3: {
		label: "Электричество Т3",
		short: "Т3",
		unit: "кВт·ч",
		kind: "elec",
		decimals: 2
	}
};
var DEFAULT_TARIFFS = {
	elec_t1: 7.1,
	elec_t2: 2.82,
	elec_t3: 5.8,
	water_cold: 45.2,
	water_hot: 150
};
var DEFAULT_PREVIOUS = {
	hot: 22.081,
	cold: 48.256,
	t1: 348.79,
	t2: 192.14,
	t3: 87.53
};
function clampReading(value, decimals) {
	return Number(Math.min(decimals === 3 ? 99999.999 : 99999.99, Math.max(0, Number.isFinite(value) ? value : 0)).toFixed(decimals));
}
function splitDigits(value, intLen, fracLen) {
	const [iRaw, fRaw = ""] = clampReading(value, fracLen).toFixed(fracLen).split(".");
	return {
		intDigits: iRaw.padStart(intLen, "0").slice(-intLen).split("").map(Number),
		fracDigits: fRaw.padEnd(fracLen, "0").slice(0, fracLen).split("").map(Number)
	};
}
function splitLcdDigits(value, intLen, fracLen) {
	const { intDigits, fracDigits } = splitDigits(value, intLen, fracLen);
	let leading = true;
	return {
		intDigits: intDigits.map((d, idx) => {
			if (leading && d === 0 && idx < intDigits.length - 1) return null;
			leading = false;
			return d;
		}),
		fracDigits
	};
}
function formatReading(value, decimals) {
	return clampReading(value, decimals).toFixed(decimals).replace(".", ",");
}
function formatMoney(value) {
	return value.toLocaleString("ru-RU", {
		minimumFractionDigits: 2,
		maximumFractionDigits: 2
	}) + " ₽";
}
function parseReading(input, decimals) {
	const normalized = input.trim().replace(/\s/g, "").replace(",", ".");
	if (!normalized) return null;
	const n = Number(normalized);
	if (!Number.isFinite(n)) return null;
	return clampReading(n, decimals);
}
var LABELS = {
	hot: "Горячая",
	cold: "Холодная",
	t1: "Т1",
	t2: "Т2",
	t3: "Т3"
};
function validateReadings(current, previous) {
	const keys = [
		"t1",
		"t2",
		"t3",
		"cold",
		"hot"
	];
	const errors = [];
	for (const key of keys) if (current[key] < previous[key]) errors.push(`${LABELS[key]}: ${formatReading(current[key], METER_META[key].decimals)} меньше прошлых ${formatReading(previous[key], METER_META[key].decimals)}`);
	return errors;
}
function computeReceipt(current, previous, tariffs, date = /* @__PURE__ */ new Date()) {
	const errors = validateReadings(current, previous);
	if (errors.length) return {
		errors,
		receipt: null
	};
	const use = {
		t1: current.t1 - previous.t1,
		t2: current.t2 - previous.t2,
		t3: current.t3 - previous.t3,
		cold: current.cold - previous.cold,
		hot: current.hot - previous.hot
	};
	const costElec = use.t1 * tariffs.elec_t1 + use.t2 * tariffs.elec_t2 + use.t3 * tariffs.elec_t3;
	const costWater = use.cold * tariffs.water_cold + use.hot * tariffs.water_hot;
	return {
		errors: [],
		receipt: {
			date: date.toLocaleDateString("ru-RU"),
			current: { ...current },
			previous: { ...previous },
			use,
			costElec,
			costWater,
			total: costElec + costWater
		}
	};
}
function receiptToCsv(rows) {
	const lines = [[
		"Дата",
		"Расход T1",
		"Расход T2",
		"Расход T3",
		"Расход ХВС",
		"Расход ГВС",
		"Сумма свет",
		"Сумма вода",
		"Итого"
	].join(";")];
	for (const r of rows) lines.push([
		r.date,
		r.use.t1.toFixed(2),
		r.use.t2.toFixed(2),
		r.use.t3.toFixed(2),
		r.use.cold.toFixed(3),
		r.use.hot.toFixed(3),
		r.costElec.toFixed(2),
		r.costWater.toFixed(2),
		r.total.toFixed(2)
	].join(";"));
	return "﻿" + lines.join("\n");
}
var MAP = {
	"0": "abcdef",
	"1": "bc",
	"2": "abdeg",
	"3": "abcdg",
	"4": "bcfg",
	"5": "acdfg",
	"6": "acdefg",
	"7": "abc",
	"8": "abcdefg",
	"9": "abcdfg"
};
var PARTS = [
	"a",
	"b",
	"c",
	"d",
	"e",
	"f",
	"g"
];
function SevenSeg({ digit }) {
	const on = digit === null ? "" : MAP[String(digit)] ?? "";
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
		className: "seg",
		"aria-hidden": "true",
		children: PARTS.map((p) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: `seg-${p}${on.includes(p) ? " is-on" : ""}` }, p))
	});
}
function ElectricMeter({ tariff, value, previous, onOpen }) {
	const { intDigits, fracDigits } = splitLcdDigits(value, 5, 2);
	const below = value < previous;
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("article", {
		className: "relative",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "elec-meter",
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "elec-bezel",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "elec-lcd",
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
								className: "elec-tariff",
								children: tariff
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
								className: "elec-unit",
								children: "кВт·ч"
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "elec-lcd-grid" }),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "elec-lcd-row",
								"aria-hidden": "true",
								children: [
									intDigits.map((d, i) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(SevenSeg, { digit: d }, `i${i}`)),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "seg-comma" }),
									fracDigits.map((d, i) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(SevenSeg, { digit: d }, `f${i}`))
								]
							})
						]
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
						className: "elec-led",
						"aria-hidden": "true"
					})]
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "elec-meta",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "elec-brand",
						children: "Меркурий 200.02"
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "elec-sub",
						children: "230 В · 5(60) А · 50 Гц"
					})] }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "elec-serial",
						children: ["№ 46206583-22", /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { children: "ГОСТ 31818.11" })]
					})]
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "elec-stickers",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
						className: "elec-sticker",
						children: "Изготовитель ООО «НПФ МОССАР»"
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
						className: "elec-sticker elec-sticker-seal",
						children: "Опломбировано АО «Мосэнергосбыт»"
					})]
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
					type: "button",
					className: "elec-tap",
					onClick: onOpen,
					"aria-label": `Электричество ${tariff}`,
					children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
						className: "sr-only",
						children: [
							tariff,
							" ",
							formatReading(value, 2),
							" киловатт-часов"
						]
					})
				})
			]
		}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
			className: "mt-2 text-center text-xs text-muted",
			children: [
				"Текущие",
				" ",
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
					className: "font-mono text-fg tabular-nums",
					children: formatReading(value, 2)
				}),
				" кВт·ч",
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
					className: "mx-1.5 text-border",
					children: "·"
				}),
				"прошлые ",
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
					className: "font-mono tabular-nums",
					children: formatReading(previous, 2)
				}),
				below ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
					className: "ml-2 font-medium text-hot",
					children: "меньше прошлых"
				}) : null
			]
		})]
	});
}
function MeterBarcode({ serial }) {
	const bars = Array.from(serial).flatMap((ch, i) => {
		const n = ch.charCodeAt(0) + i * 7;
		return [1 + n % 3, 1 + n * 3 % 2];
	});
	let x = 0;
	const rects = bars.map((w, i) => {
		const el = i % 2 === 0 ? {
			x,
			w,
			key: i
		} : null;
		x += w + 1;
		return el;
	});
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("svg", {
		viewBox: `0 0 ${x} 20`,
		role: "img",
		"aria-label": `Штрихкод ${serial}`,
		children: rects.map((r) => r ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("rect", {
			x: r.x,
			y: "0",
			width: r.w,
			height: "20"
		}, r.key) : null)
	});
}
function DigitColumn({ value, tone }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
		className: tone === "red" ? "digit-cell digit-cell-red" : "digit-cell",
		children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
			className: "digit-strip",
			style: { transform: `translateY(${-value * 28}px)` },
			children: Array.from({ length: 10 }, (_, n) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: n }, n))
		})
	});
}
function WaterMeter({ kind, value, previous, serial, onOpen }) {
	const { intDigits, fracDigits } = splitDigits(value, 5, 3);
	const isHot = kind === "hot";
	const below = value < previous;
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("article", {
		className: "relative",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: isHot ? "water-badge water-badge-hot" : "water-badge water-badge-cold",
				children: isHot ? "ГВС" : "ХВС"
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "water-meter",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "water-meter-face",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "water-serial",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(MeterBarcode, { serial }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: serial })]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "water-window",
							"aria-hidden": "true",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "water-led" }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "water-digits",
								children: [intDigits.map((d, i) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(DigitColumn, {
									value: d,
									tone: "black"
								}, `i${i}`)), fracDigits.map((d, i) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(DigitColumn, {
									value: d,
									tone: "red"
								}, `f${i}`))]
							})]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: isHot ? "water-module water-module-hot" : "water-module water-module-cold",
							children: [
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
									className: "water-module-brand",
									children: "rubetek"
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
									className: "water-module-chip",
									children: "CRT750S"
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
									className: "water-module-model",
									children: "СВК 15-3-8-1 · 3 В · RF 868"
								})
							]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "water-spec",
							children: "Модель прибора учёта СВК 15-3-8-1"
						})
					]
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
					type: "button",
					className: "water-tap",
					onClick: onOpen,
					"aria-label": isHot ? "Горячая вода" : "Холодная вода",
					children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
						className: "sr-only",
						children: [
							isHot ? "Горячая вода" : "Холодная вода",
							" ",
							formatReading(value, 3)
						]
					})
				})]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
				className: "mt-3 text-center text-xs text-muted",
				children: [
					"Текущие",
					" ",
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
						className: "font-mono text-fg tabular-nums",
						children: formatReading(value, 3)
					}),
					" м³",
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
						className: "mx-1.5 text-border",
						children: "·"
					}),
					"прошлые",
					" ",
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
						className: "font-mono tabular-nums",
						children: formatReading(previous, 3)
					}),
					below ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
						className: "ml-2 font-medium text-hot",
						children: "меньше прошлых"
					}) : null
				]
			})
		]
	});
}
function getTelegram() {
	if (typeof window === "undefined") return null;
	const wa = window.Telegram?.WebApp;
	if (!wa) return null;
	if (!wa.initData && !wa.MainButton) return wa;
	return wa;
}
function isInsideTelegram() {
	const wa = getTelegram();
	return Boolean(wa && wa.initData);
}
function haptic(kind = "light") {
	const hf = getTelegram()?.HapticFeedback;
	if (!hf) return;
	try {
		if (kind === "light") hf.impactOccurred("light");
		else hf.notificationOccurred(kind);
	} catch {}
}
function initTelegram() {
	const wa = getTelegram();
	if (!wa) return;
	try {
		wa.ready();
		wa.expand();
		wa.enableClosingConfirmation?.();
	} catch {}
}
var KEYS = [
	"1",
	"2",
	"3",
	"4",
	"5",
	"6",
	"7",
	"8",
	"9",
	",",
	"0",
	"back"
];
function KeypadDrawer({ meter, value, previous, open, onOpenChange, onCommit }) {
	const meta = meter ? METER_META[meter] : null;
	const [draft, setDraft] = (0, import_react.useState)("");
	(0, import_react.useEffect)(() => {
		if (open && meta) setDraft(formatReading(value, meta.decimals));
	}, [
		open,
		meter,
		value,
		meta
	]);
	if (!meta || !meter) return null;
	const decimals = meta.decimals;
	function typeKey(key) {
		haptic("light");
		setDraft((prev) => {
			if (key === "back") return prev.slice(0, -1);
			if (key === ",") {
				if (prev.includes(",") || prev.includes(".")) return prev;
				return prev.length ? prev + "," : "0,";
			}
			const next = (prev === "0" ? "" : prev) + key;
			const [intPart = "", frac = ""] = next.replace(".", ",").split(",");
			if (intPart.replace(/^0+/, "").length > 5 && intPart !== "0") return prev;
			if (frac.length > decimals) return prev;
			return next;
		});
	}
	function confirm() {
		const parsed = parseReading(draft || "0", decimals);
		if (parsed === null) return;
		haptic("success");
		onCommit(parsed);
		onOpenChange(false);
	}
	const below = (parseReading(draft || "0", decimals) ?? 0) < previous;
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Drawer.Root, {
		open,
		onOpenChange,
		children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Drawer.Portal, { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Drawer.Overlay, { className: "fixed inset-0 z-40 bg-fg/40" }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Drawer.Content, {
			className: "fixed inset-x-0 bottom-0 z-50 mx-auto max-w-lg rounded-t-[28px] bg-surface outline-none",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "mx-auto mt-3 h-1 w-10 rounded-full bg-border" }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-4",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Drawer.Title, {
						className: "text-base font-medium",
						children: meta.label
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Drawer.Description, {
						className: "mt-1 text-sm text-muted",
						children: [
							"Прошлые показания ",
							formatReading(previous, meta.decimals),
							" ",
							meta.unit
						]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
						className: cn("mt-4 rounded-xl bg-surface-2 px-4 py-3 text-right font-mono text-3xl tabular-nums tracking-tight", below && "text-hot"),
						children: [draft || "0", /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
							className: "ml-2 text-base text-muted",
							children: meta.unit
						})]
					}),
					below ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "mt-2 text-xs font-medium text-hot",
						children: "Значение меньше предыдущего."
					}) : null,
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "keypad-grid mt-4",
						children: KEYS.map((key) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
							type: "button",
							className: "keypad-key",
							onClick: () => typeKey(key),
							"aria-label": key === "back" ? "Стереть" : key,
							children: key === "back" ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Delete, { className: "mx-auto size-5" }) : key
						}, key))
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Button, {
						className: "mt-4 w-full",
						size: "lg",
						onClick: confirm,
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Check, { className: "size-4" }), "Сохранить"]
					})
				]
			})]
		})] })
	});
}
var Input = import_react.forwardRef(({ className, type, ...props }, ref) => {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
		type,
		className: cn("flex h-11 w-full rounded-md border border-border bg-surface-2 px-3 text-base text-fg shadow-inner", "placeholder:text-muted/70", "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30", "disabled:cursor-not-allowed disabled:opacity-50", className),
		ref,
		...props
	});
});
Input.displayName = "Input";
var Label = import_react.forwardRef(({ className, ...props }, ref) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("label", {
	ref,
	className: cn("text-sm font-medium text-fg leading-none", className),
	...props
}));
Label.displayName = "Label";
var useMeterStore = create()(persist((set) => ({
	current: { ...DEFAULT_PREVIOUS },
	previous: { ...DEFAULT_PREVIOUS },
	tariffs: { ...DEFAULT_TARIFFS },
	history: [],
	setCurrent: (key, value) => set((s) => ({ current: {
		...s.current,
		[key]: clampReading(value, METER_META[key].decimals)
	} })),
	setPrevious: (key, value) => set((s) => ({ previous: {
		...s.previous,
		[key]: clampReading(value, METER_META[key].decimals)
	} })),
	setTariff: (key, value) => set((s) => ({ tariffs: {
		...s.tariffs,
		[key]: Math.max(0, Number(value.toFixed(2)))
	} })),
	snapshotAsInitial: () => set((s) => ({ previous: { ...s.current } })),
	commitReceipt: (receipt) => set((s) => ({
		previous: { ...receipt.current },
		current: { ...receipt.current },
		history: [receipt, ...s.history].slice(0, 36)
	})),
	clearHistory: () => set({ history: [] }),
	resetAll: () => set({
		current: { ...DEFAULT_PREVIOUS },
		previous: { ...DEFAULT_PREVIOUS },
		tariffs: { ...DEFAULT_TARIFFS },
		history: []
	})
}), {
	name: "pokazaniya-v1",
	skipHydration: true
}));
var TARIFF_META = [
	{
		key: "elec_t1",
		label: "Электричество Т1, ₽/кВт·ч"
	},
	{
		key: "elec_t2",
		label: "Электричество Т2, ₽/кВт·ч"
	},
	{
		key: "elec_t3",
		label: "Электричество Т3, ₽/кВт·ч"
	},
	{
		key: "water_hot",
		label: "Горячая вода, ₽/м³"
	},
	{
		key: "water_cold",
		label: "Холодная вода, ₽/м³"
	}
];
var ORDER = [
	"hot",
	"cold",
	"t1",
	"t2",
	"t3"
];
function SettingsDrawer({ open, onOpenChange }) {
	const previous = useMeterStore((s) => s.previous);
	const tariffs = useMeterStore((s) => s.tariffs);
	const setPrevious = useMeterStore((s) => s.setPrevious);
	const setTariff = useMeterStore((s) => s.setTariff);
	const snapshotAsInitial = useMeterStore((s) => s.snapshotAsInitial);
	const resetAll = useMeterStore((s) => s.resetAll);
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Drawer.Root, {
		open,
		onOpenChange,
		children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Drawer.Portal, { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Drawer.Overlay, { className: "fixed inset-0 z-40 bg-fg/40" }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Drawer.Content, {
			className: "fixed inset-x-0 bottom-0 z-50 mx-auto flex max-h-[92vh] max-w-lg flex-col rounded-t-[28px] bg-surface outline-none",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "mx-auto mt-3 h-1 w-10 shrink-0 rounded-full bg-border" }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "overflow-y-auto px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-4",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Drawer.Title, {
						className: "text-base font-medium",
						children: "Настройки"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Drawer.Description, {
						className: "mt-1 text-sm text-muted",
						children: "Начальные показания, тарифы и код бота."
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h3", {
						className: "mt-6 text-xs font-medium uppercase tracking-[0.14em] text-muted",
						children: "Прошлые показания"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "mt-3 grid gap-3",
						children: ORDER.map((key) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "grid gap-1.5",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Label, {
								htmlFor: `prev-${key}`,
								children: [
									METER_META[key].label,
									", ",
									METER_META[key].unit
								]
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
								id: `prev-${key}`,
								inputMode: "decimal",
								defaultValue: formatReading(previous[key], METER_META[key].decimals),
								onBlur: (e) => {
									const n = parseReading(e.target.value, METER_META[key].decimals);
									if (n !== null) setPrevious(key, n);
								}
							}, `${key}-${previous[key]}`)]
						}, key))
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
						variant: "secondary",
						className: "mt-3 w-full",
						onClick: () => snapshotAsInitial(),
						children: "Взять текущие как начальные"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h3", {
						className: "mt-8 text-xs font-medium uppercase tracking-[0.14em] text-muted",
						children: "Тарифы"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "mt-3 grid gap-3",
						children: TARIFF_META.map((row) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "grid gap-1.5",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Label, {
								htmlFor: `tar-${row.key}`,
								children: row.label
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
								id: `tar-${row.key}`,
								inputMode: "decimal",
								defaultValue: tariffs[row.key].toFixed(2).replace(".", ","),
								onBlur: (e) => {
									const n = parseReading(e.target.value, 2);
									if (n !== null) setTariff(row.key, n);
								}
							}, `${row.key}-${tariffs[row.key]}`)]
						}, row.key))
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h3", {
						className: "mt-8 text-xs font-medium uppercase tracking-[0.14em] text-muted",
						children: "Telegram-бот"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
						className: "mt-2 text-sm leading-relaxed text-muted",
						children: [
							"Это мини-приложение. Подключите его к боту: скачайте",
							" ",
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("code", {
								className: "font-mono text-fg",
								children: "bot.py"
							}),
							", укажите токен и URL приложения."
						]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("a", {
						href: "/bot.py",
						download: "bot.py",
						className: "mt-3 inline-flex h-11 w-full items-center justify-center rounded-md border border-border bg-surface-2 text-sm font-medium",
						children: "Скачать bot.py"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("pre", {
						className: "mt-3 overflow-x-auto rounded-xl bg-primary p-3 font-mono text-[11px] leading-relaxed text-primary-fg",
						children: `TELEGRAM_BOT_TOKEN=...
MINIAPP_URL=https://ваш-адрес/
ADMIN_IDS=528656263`
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
						variant: "outline",
						className: "mt-8 w-full",
						onClick: () => resetAll(),
						children: "Сбросить все данные"
					})
				]
			})]
		})] })
	});
}
function HistoryDrawer({ open, onOpenChange }) {
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
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Drawer.Root, {
		open,
		onOpenChange,
		children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Drawer.Portal, { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Drawer.Overlay, { className: "fixed inset-0 z-40 bg-fg/40" }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Drawer.Content, {
			className: "fixed inset-x-0 bottom-0 z-50 mx-auto flex max-h-[92vh] max-w-lg flex-col rounded-t-[28px] bg-surface outline-none",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "mx-auto mt-3 h-1 w-10 shrink-0 rounded-full bg-border" }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "overflow-y-auto px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-4",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Drawer.Title, {
						className: "text-base font-medium",
						children: "История расчётов"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Drawer.Description, {
						className: "mt-1 text-sm text-muted",
						children: "Последние квитанции на этом устройстве."
					}),
					history.length === 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "mt-8 text-sm text-muted",
						children: "Пока пусто — сначала посчитайте месяц."
					}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("ul", {
						className: "mt-4 space-y-3",
						children: history.map((row, i) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("li", {
							className: "rounded-2xl border border-border bg-surface-2 p-4",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "flex items-baseline justify-between gap-3",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
									className: "text-sm font-medium",
									children: row.date
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
									className: "font-mono text-sm tabular-nums",
									children: formatMoney(row.total)
								})]
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
								className: "mt-2 text-xs text-muted",
								children: [
									"ГВС ",
									formatReading(row.use.hot, 1),
									" · ХВС ",
									formatReading(row.use.cold, 1),
									" · Т1",
									" ",
									formatReading(row.use.t1, 1),
									" · Т2 ",
									formatReading(row.use.t2, 1),
									" · Т3",
									" ",
									formatReading(row.use.t3, 1)
								]
							})]
						}, `${row.date}-${i}`))
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "mt-4 flex gap-2",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
							variant: "secondary",
							className: "flex-1",
							disabled: !history.length,
							onClick: downloadCsv,
							children: "Скачать CSV"
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
							variant: "outline",
							className: "flex-1",
							disabled: !history.length,
							onClick: () => clearHistory(),
							children: "Очистить"
						})]
					})
				]
			})]
		})] })
	});
}
function ReceiptView({ receipt, onBack, onSave, onSend }) {
	const tg = isInsideTelegram();
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
		className: "mx-auto w-full max-w-lg px-4 pb-28 pt-4",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
				type: "button",
				onClick: onBack,
				className: "mb-4 inline-flex items-center gap-1.5 text-sm text-muted",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(ArrowLeft, { className: "size-4" }), "К счётчикам"]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "rounded-[28px] border border-border bg-surface-2 p-5 shadow-sm",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "text-xs font-medium uppercase tracking-[0.16em] text-muted",
						children: "Квитанция"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("h2", {
						className: "mt-1 text-xl font-medium tracking-tight",
						children: ["Расчёт за ", receipt.date]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "mt-5 space-y-4",
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
									className: "text-xs font-medium uppercase tracking-[0.14em] text-muted",
									children: "Электричество"
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("ul", {
									className: "mt-2 space-y-1 text-sm",
									children: [
										/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("li", {
											className: "flex justify-between font-mono tabular-nums",
											children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "Т1" }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { children: [formatReading(receipt.use.t1, 1), " кВт·ч"] })]
										}),
										/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("li", {
											className: "flex justify-between font-mono tabular-nums",
											children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "Т2" }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { children: [formatReading(receipt.use.t2, 1), " кВт·ч"] })]
										}),
										/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("li", {
											className: "flex justify-between font-mono tabular-nums",
											children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "Т3" }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { children: [formatReading(receipt.use.t3, 1), " кВт·ч"] })]
										})
									]
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
									className: "mt-2 flex justify-between text-sm",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
										className: "text-muted",
										children: "Сумма за свет"
									}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
										className: "font-medium tabular-nums",
										children: formatMoney(receipt.costElec)
									})]
								})
							] }),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "h-px bg-border" }),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
									className: "text-xs font-medium uppercase tracking-[0.14em] text-muted",
									children: "Вода"
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("ul", {
									className: "mt-2 space-y-1 text-sm",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("li", {
										className: "flex justify-between font-mono tabular-nums",
										children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "Горячая" }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { children: [formatReading(receipt.use.hot, 1), " м³"] })]
									}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("li", {
										className: "flex justify-between font-mono tabular-nums",
										children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "Холодная" }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { children: [formatReading(receipt.use.cold, 1), " м³"] })]
									})]
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
									className: "mt-2 flex justify-between text-sm",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
										className: "text-muted",
										children: "Сумма за воду"
									}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
										className: "font-medium tabular-nums",
										children: formatMoney(receipt.costWater)
									})]
								})
							] }),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "h-px bg-border" }),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
								className: "flex items-baseline justify-between",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
									className: "text-sm font-medium",
									children: "Итого к оплате"
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
									className: "font-mono text-2xl font-medium tabular-nums tracking-tight",
									children: formatMoney(receipt.total)
								})]
							})
						]
					})
				]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "mt-4 flex flex-col gap-2",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
					size: "lg",
					className: "w-full",
					onClick: onSave,
					children: "Сохранить и зафиксировать"
				}), tg ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Button, {
					size: "lg",
					variant: "secondary",
					className: "w-full",
					onClick: onSend,
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Send, { className: "size-4" }), "Отправить в чат бота"]
				}) : null]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "mt-3 text-center text-xs text-muted",
				children: "После сохранения текущие станут прошлыми для следующего месяца."
			})
		]
	});
}
var SERIAL = {
	hot: "1011051599503",
	cold: "1011052063508"
};
function AppHome() {
	const current = useMeterStore((s) => s.current);
	const previous = useMeterStore((s) => s.previous);
	const tariffs = useMeterStore((s) => s.tariffs);
	const setCurrent = useMeterStore((s) => s.setCurrent);
	const commitReceipt = useMeterStore((s) => s.commitReceipt);
	const [tab, setTab] = (0, import_react.useState)("water");
	const [editKey, setEditKey] = (0, import_react.useState)(null);
	const [keypadOpen, setKeypadOpen] = (0, import_react.useState)(false);
	const [settingsOpen, setSettingsOpen] = (0, import_react.useState)(false);
	const [historyOpen, setHistoryOpen] = (0, import_react.useState)(false);
	const [receipt, setReceipt] = (0, import_react.useState)(null);
	const [errors, setErrors] = (0, import_react.useState)([]);
	(0, import_react.useEffect)(() => {
		useMeterStore.persist.rehydrate();
		initTelegram();
	}, []);
	const month = (0, import_react.useMemo)(() => format(/* @__PURE__ */ new Date(), "LLLL yyyy", { locale: ru }), []);
	function openMeter(key) {
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
		if (wa && isInsideTelegram()) wa.sendData(JSON.stringify({
			hot: receipt.current.hot,
			cold: receipt.current.cold,
			t1: receipt.current.t1,
			t2: receipt.current.t2,
			t3: receipt.current.t3,
			use: receipt.use,
			cost_elec: receipt.costElec,
			cost_water: receipt.costWater,
			total: receipt.total,
			date: receipt.date
		}));
		setReceipt(null);
	}
	(0, import_react.useEffect)(() => {
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
	}, [
		receipt,
		current,
		previous,
		tariffs
	]);
	if (receipt) return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
		className: "min-h-dvh",
		children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ReceiptView, {
			receipt,
			onBack: () => setReceipt(null),
			onSave: saveReceipt,
			onSend: sendToBot
		})
	});
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "mx-auto flex min-h-dvh w-full max-w-lg flex-col md:max-w-5xl",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("header", {
				className: "sticky top-0 z-20 border-b border-border/70 bg-bg/85 px-4 pb-3 pt-[max(0.9rem,env(safe-area-inset-top))] backdrop-blur-sm",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "flex items-start justify-between gap-3",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "text-[11px] font-medium uppercase tracking-[0.18em] text-muted",
							children: "Коммунальный учёт"
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h1", {
							className: "mt-0.5 text-2xl font-medium tracking-tight",
							children: "Показания"
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "mt-0.5 text-sm text-muted",
							children: month
						})
					] }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "flex gap-1",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
							variant: "ghost",
							size: "icon",
							"aria-label": "История",
							onClick: () => setHistoryOpen(true),
							children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(History, { className: "size-5" })
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
							variant: "ghost",
							size: "icon",
							"aria-label": "Настройки",
							onClick: () => setSettingsOpen(true),
							children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Settings2, { className: "size-5" })
						})]
					})]
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					className: "mt-3 flex gap-1.5 overflow-x-auto pb-0.5 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
					children: [
						"hot",
						"cold",
						"t1",
						"t2",
						"t3"
					].map((key) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
						type: "button",
						className: "summary-chip",
						onClick: () => openMeter(key),
						children: [
							METER_META[key].short,
							" ",
							formatReading(current[key], METER_META[key].decimals)
						]
					}, key))
				})]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "px-4 pt-4 md:hidden",
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "grid grid-cols-2 rounded-full bg-surface p-1",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
						type: "button",
						className: cn("h-10 rounded-full text-sm font-medium transition-colors duration-[var(--motion-quick)]", tab === "water" ? "bg-surface-2 text-fg shadow-sm" : "text-muted"),
						onClick: () => setTab("water"),
						children: "Вода"
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
						type: "button",
						className: cn("h-10 rounded-full text-sm font-medium transition-colors duration-[var(--motion-quick)]", tab === "elec" ? "bg-surface-2 text-fg shadow-sm" : "text-muted"),
						onClick: () => setTab("elec"),
						children: "Электричество"
					})]
				})
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("main", {
				className: "flex-1 px-4 pb-32 pt-5",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "md:grid md:grid-cols-2 md:items-start md:gap-10",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: cn("flex flex-col gap-10", tab !== "water" && "hidden md:flex"),
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(WaterMeter, {
							kind: "hot",
							value: current.hot,
							previous: previous.hot,
							serial: SERIAL.hot,
							onOpen: () => openMeter("hot")
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(WaterMeter, {
							kind: "cold",
							value: current.cold,
							previous: previous.cold,
							serial: SERIAL.cold,
							onOpen: () => openMeter("cold")
						})]
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: cn("flex flex-col gap-5", tab !== "elec" && "hidden md:flex"),
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)(ElectricMeter, {
								tariff: "T1",
								value: current.t1,
								previous: previous.t1,
								onOpen: () => openMeter("t1")
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)(ElectricMeter, {
								tariff: "T2",
								value: current.t2,
								previous: previous.t2,
								onOpen: () => openMeter("t2")
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)(ElectricMeter, {
								tariff: "T3",
								value: current.t3,
								previous: previous.t3,
								onOpen: () => openMeter("t3")
							})
						]
					})]
				}), errors.length ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "mt-6 rounded-2xl border border-hot/30 bg-hot/10 px-4 py-3 text-sm text-hot",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "font-medium",
						children: "Новые показания меньше предыдущих"
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("ul", {
						className: "mt-1 space-y-0.5",
						children: errors.map((e) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("li", { children: e }, e))
					})]
				}) : null]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "pointer-events-none sticky bottom-0 z-20 bg-gradient-to-t from-bg via-bg to-transparent px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-6",
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
					size: "lg",
					className: "pointer-events-auto w-full",
					onClick: calculate,
					children: "Рассчитать"
				})
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(KeypadDrawer, {
				meter: editKey,
				value: editKey ? current[editKey] : 0,
				previous: editKey ? previous[editKey] : 0,
				open: keypadOpen,
				onOpenChange: setKeypadOpen,
				onCommit: (v) => {
					if (editKey) setCurrent(editKey, v);
				}
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(SettingsDrawer, {
				open: settingsOpen,
				onOpenChange: setSettingsOpen
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(HistoryDrawer, {
				open: historyOpen,
				onOpenChange: setHistoryOpen
			})
		]
	});
}
function Home() {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(AppHome, {});
}
//#endregion
export { Home as component };
