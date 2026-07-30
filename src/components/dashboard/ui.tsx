import { motion } from "framer-motion";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";
import type { LucideIcon } from "lucide-react";

/* ---------- Motion presets (shared language) ---------- */
export const fadeUp = {
  hidden: { opacity: 0, y: 12 },
  show: { opacity: 1, y: 0, transition: { duration: 0.35, ease: [0.22, 1, 0.36, 1] as const } },
};

export const stagger = {
  hidden: {},
  show: { transition: { staggerChildren: 0.05 } },
};

/* ---------- Surface / Card ---------- */
export function Surface({
  className,
  children,
  hover = false,
  ...rest
}: { className?: string; children: ReactNode; hover?: boolean } & React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      {...rest}
      className={cn(
        "rounded-[20px] border border-border/70 bg-card/70 backdrop-blur-xl",
        "shadow-[0_1px_0_0_hsl(var(--foreground)/0.04)_inset,0_12px_40px_-24px_hsl(0_0%_0%/0.9)]",
        hover &&
          "transition-all duration-300 hover:border-accent/25 hover:bg-card/90 hover:-translate-y-0.5 hover:shadow-[0_18px_50px_-28px_hsl(var(--accent)/0.35)]",
        className,
      )}
    >
      {children}
    </div>
  );
}

/* ---------- Section header ---------- */
export function SectionHeader({
  title,
  subtitle,
  icon: Icon,
  action,
}: {
  title: string;
  subtitle?: string;
  icon?: LucideIcon;
  action?: ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-4 mb-5">
      <div className="flex items-start gap-3 min-w-0">
        {Icon && (
          <span className="mt-0.5 w-9 h-9 rounded-xl bg-accent/10 border border-accent/15 flex items-center justify-center shrink-0">
            <Icon className="w-4 h-4 text-accent" />
          </span>
        )}
        <div className="min-w-0">
          <h2 className="font-display font-semibold tracking-tight text-[15px] text-foreground truncate">{title}</h2>
          {subtitle && <p className="text-xs text-muted-foreground mt-0.5 truncate">{subtitle}</p>}
        </div>
      </div>
      {action}
    </div>
  );
}

/* ---------- Animated counter ---------- */
export function AnimatedValue({ value, format }: { value: number; format: (n: number) => string }) {
  const [display, setDisplay] = useState(value);
  const fromRef = useRef(value);

  useEffect(() => {
    const from = fromRef.current;
    const to = value;
    if (from === to) return;
    const start = performance.now();
    const dur = 550;
    let raf = 0;
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / dur);
      const eased = 1 - Math.pow(1 - t, 3);
      setDisplay(from + (to - from) * eased);
      if (t < 1) raf = requestAnimationFrame(tick);
      else fromRef.current = to;
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value]);

  return <>{format(display)}</>;
}

/* ---------- Metric card ---------- */
export function MetricCard({
  label,
  value,
  icon: Icon,
  hint,
  accent,
}: {
  label: string;
  value: ReactNode;
  icon: LucideIcon;
  hint?: ReactNode;
  accent?: boolean;
}) {
  return (
    <motion.div variants={fadeUp} whileTap={{ scale: 0.99 }}>
      <Surface hover className="relative overflow-hidden p-5">
        {accent && (
          <div className="pointer-events-none absolute -top-16 -right-10 w-40 h-40 rounded-full bg-accent/10 blur-3xl" />
        )}
        <div className="relative flex items-start justify-between gap-3">
          <p className="text-[11px] uppercase tracking-[0.12em] text-muted-foreground font-medium">{label}</p>
          <span className="w-8 h-8 rounded-lg bg-secondary/70 border border-border/70 flex items-center justify-center shrink-0">
            <Icon className="w-4 h-4 text-accent" />
          </span>
        </div>
        <p className="relative mt-3 font-display text-2xl font-semibold tracking-tight tabular-nums">{value}</p>
        {hint && <div className="relative mt-2 text-xs text-muted-foreground">{hint}</div>}
      </Surface>
    </motion.div>
  );
}

/* ---------- Trend pill ---------- */
export function Trend({ delta, suffix = "vs. período anterior" }: { delta: number | null; suffix?: string }) {
  if (delta === null || !isFinite(delta)) {
    return <span className="text-muted-foreground">sem base de comparação</span>;
  }
  const up = delta >= 0;
  return (
    <span className="inline-flex items-center gap-1.5">
      <span
        className={cn(
          "inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[11px] font-semibold",
          up ? "bg-emerald-500/10 text-emerald-400" : "bg-destructive/10 text-destructive",
        )}
      >
        {up ? "▲" : "▼"} {Math.abs(delta).toFixed(1)}%
      </span>
      <span className="text-muted-foreground">{suffix}</span>
    </span>
  );
}

/* ---------- Empty state ---------- */
export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col items-center justify-center text-center py-10 px-6", className)}>
      <div className="relative mb-4">
        <div className="absolute inset-0 rounded-2xl bg-accent/10 blur-xl" />
        <div className="relative w-12 h-12 rounded-2xl border border-border bg-secondary/60 flex items-center justify-center">
          <Icon className="w-5 h-5 text-accent" />
        </div>
      </div>
      <p className="font-display font-semibold text-sm text-foreground">{title}</p>
      <p className="text-xs text-muted-foreground mt-1 max-w-[38ch] leading-relaxed">{description}</p>
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

/* ---------- Skeleton ---------- */
export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("animate-pulse rounded-xl bg-secondary/60", className)} />;
}

/* ---------- Chart tooltip ---------- */
export function ChartTooltip({
  active,
  payload,
  label,
  formatter,
}: {
  active?: boolean;
  payload?: any[];
  label?: string;
  formatter?: (v: number) => string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl border border-border bg-popover/95 backdrop-blur-xl px-3 py-2 shadow-2xl">
      <p className="text-[11px] text-muted-foreground mb-1">{label}</p>
      {payload.map((p) => (
        <p key={p.dataKey} className="text-sm font-semibold tabular-nums text-foreground">
          {formatter ? formatter(Number(p.value)) : p.value}
        </p>
      ))}
    </div>
  );
}
