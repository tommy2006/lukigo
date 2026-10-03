"use client";
// Shared UI kit. Dark, glassy, warm-accent design. Fonts: Bricolage Grotesque (sans), Instrument Serif (accents), JetBrains Mono (numbers).
import clsx from "clsx";
import { AnimatePresence, motion } from "framer-motion";
import { X, Sparkles, Loader2 } from "lucide-react";
import React from "react";

export { clsx as cx };

type BtnProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "ghost" | "outline" | "danger" | "ai";
  size?: "sm" | "md" | "lg";
  loading?: boolean;
};
export function Button({ variant = "primary", size = "md", loading, className, children, disabled, ...rest }: BtnProps) {
  return (
    <button
      {...rest}
      disabled={disabled || loading}
      className={clsx(
        "inline-flex items-center justify-center gap-2 rounded-xl font-semibold transition-all active:scale-[0.98] disabled:opacity-50 disabled:pointer-events-none whitespace-nowrap",
        size === "sm" && "h-8 px-3 text-[13px]",
        size === "md" && "h-10 px-4 text-sm",
        size === "lg" && "h-12 px-6 text-base",
        variant === "primary" && "bg-gradient-to-r from-[#ffb3a0] via-accent to-accent-2 text-[#2a1208] shadow-[0_6px_24px_-8px_rgba(255,154,118,0.7)] hover:brightness-105",
        variant === "ai" && "bg-gradient-to-r from-[#9ad8ff] to-violet text-[#140d33] shadow-[0_6px_24px_-8px_rgba(185,166,255,0.7)] hover:brightness-105",
        variant === "ghost" && "text-ink-2 hover:text-ink hover:bg-panel-2",
        variant === "outline" && "border border-line-2 text-ink hover:bg-panel-2",
        variant === "danger" && "bg-bad/15 text-bad border border-bad/30 hover:bg-bad/25",
        className
      )}
    >
      {loading && <Loader2 className="size-4 animate-spin" />}
      {children}
    </button>
  );
}

export function Card({ className, children, ...rest }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div {...rest} className={clsx("glass rounded-2xl p-5", className)}>
      {children}
    </div>
  );
}

export function Label({ children, hint }: { children: React.ReactNode; hint?: string }) {
  return (
    <label className="block text-[12px] font-semibold uppercase tracking-wider text-ink-3 mb-1.5">
      {children} {hint && <span className="normal-case tracking-normal font-normal text-ink-3/80">— {hint}</span>}
    </label>
  );
}

const fieldCls =
  "w-full rounded-xl bg-white/[0.04] border border-line px-3.5 py-2.5 text-sm text-ink placeholder:text-ink-3 outline-none focus:border-accent/60 focus:bg-white/[0.06] transition";

export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(function Input({ className, ...p }, ref) {
  return <input ref={ref} {...p} className={clsx(fieldCls, className)} />;
});
export function Textarea({ className, ...p }: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...p} className={clsx(fieldCls, "min-h-24 resize-y", className)} />;
}
export function Select({ className, children, ...p }: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select {...p} className={clsx(fieldCls, "appearance-none pr-8 cursor-pointer", className)}>
      {children}
    </select>
  );
}

export function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <Label hint={hint}>{label}</Label>
      {children}
    </div>
  );
}

export function Badge({ children, color, className }: { children: React.ReactNode; color?: string; className?: string }) {
  return (
    <span
      className={clsx("inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11.5px] font-semibold border", className)}
      style={color ? { color, borderColor: color + "55", background: color + "1a" } : undefined}
    >
      {children}
    </span>
  );
}

export function Progress({ value, color = "var(--accent)", className, height = 8 }: { value: number; color?: string; className?: string; height?: number }) {
  const v = Math.max(0, Math.min(100, value || 0));
  return (
    <div className={clsx("w-full rounded-full bg-white/[0.07] overflow-hidden", className)} style={{ height }}>
      <motion.div
        initial={{ width: 0 }}
        animate={{ width: `${v}%` }}
        transition={{ type: "spring", stiffness: 80, damping: 18 }}
        className="h-full rounded-full"
        style={{ background: color }}
      />
    </div>
  );
}

export function Avatar({ name, color, size = 32 }: { name?: string | null; color?: string | null; size?: number }) {
  const initials = (name || "?").split(" ").map((w) => w[0]).slice(0, 2).join("").toUpperCase();
  const hue = [...(name || "x")].reduce((a, c) => a + c.charCodeAt(0), 0) % 360;
  return (
    <div
      className="shrink-0 rounded-full grid place-items-center font-bold text-[#1a1020]"
      style={{ width: size, height: size, fontSize: size * 0.38, background: color || `hsl(${hue} 85% 78%)` }}
      title={name || undefined}
    >
      {initials}
    </div>
  );
}

export function Modal({ open, onClose, title, children, wide }: { open: boolean; onClose: () => void; title: string; children: React.ReactNode; wide?: boolean }) {
  return (
    <AnimatePresence>
      {open && (
        <motion.div className="fixed inset-0 z-50 grid place-items-center p-4 bg-black/60 backdrop-blur-sm" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onMouseDown={onClose}>
          <motion.div
            onMouseDown={(e) => e.stopPropagation()}
            initial={{ y: 20, scale: 0.97, opacity: 0 }}
            animate={{ y: 0, scale: 1, opacity: 1 }}
            exit={{ y: 10, opacity: 0 }}
            className={clsx("w-full rounded-2xl border border-line-2 bg-[#16121f] p-6 shadow-2xl max-h-[88vh] overflow-y-auto", wide ? "max-w-2xl" : "max-w-md")}
          >
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-lg font-bold">{title}</h3>
              <button onClick={onClose} className="text-ink-3 hover:text-ink"><X className="size-5" /></button>
            </div>
            {children}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export function PageHeader({ emoji, title, accent, subtitle, actions }: { emoji?: string; title: string; accent?: string; subtitle?: string; actions?: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4 mb-7">
      <div>
        <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight flex items-center gap-3">
          {emoji && <span className="text-3xl">{emoji}</span>}
          <span>
            {title} {accent && <span className="serif italic grad-text font-normal">{accent}</span>}
          </span>
        </h1>
        {subtitle && <p className="text-ink-2 mt-1.5 max-w-2xl">{subtitle}</p>}
      </div>
      {actions && <div className="flex gap-2 flex-wrap">{actions}</div>}
    </div>
  );
}

export function Stat({ label, value, sub, color }: { label: string; value: React.ReactNode; sub?: React.ReactNode; color?: string }) {
  return (
    <Card className="p-4">
      <div className="text-[12px] uppercase tracking-wider text-ink-3 font-semibold">{label}</div>
      <div className="font-mono text-2xl font-bold mt-1" style={{ color }}>{value}</div>
      {sub && <div className="text-xs text-ink-3 mt-0.5">{sub}</div>}
    </Card>
  );
}

export function Empty({ emoji = "✨", title, children, action }: { emoji?: string; title: string; children?: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-dashed border-line-2 p-10 text-center">
      <div className="text-4xl mb-3">{emoji}</div>
      <div className="font-bold text-lg">{title}</div>
      {children && <div className="text-ink-2 text-sm mt-1 max-w-md mx-auto">{children}</div>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

/** A guidance callout — use liberally to coach first-time founders. */
export function Tip({ children, title = "Tip" }: { children: React.ReactNode; title?: string }) {
  return (
    <div className="rounded-xl border border-violet/25 bg-violet/[0.07] px-4 py-3 text-sm text-ink-2 flex gap-3">
      <Sparkles className="size-4 text-violet shrink-0 mt-0.5" />
      <div><span className="font-semibold text-violet">{title}: </span>{children}</div>
    </div>
  );
}

/** Container for AI-generated text. */
export function AIBox({ title = "AI summary", loading, source, children, action }: { title?: string; loading?: boolean; source?: string; children?: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div className="relative rounded-2xl p-[1px] bg-gradient-to-br from-[#9ad8ff]/50 via-violet/40 to-accent/40">
      <div className="rounded-2xl bg-[#14111d] p-5">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2 text-[12px] font-bold uppercase tracking-wider grad-text-cool">
            <Sparkles className="size-3.5 text-violet" /> {title}
            {source === "fallback" && <span className="text-ink-3 normal-case tracking-normal font-normal">(offline mode)</span>}
          </div>
          {action}
        </div>
        {loading ? (
          <div className="space-y-2"><div className="skeleton h-4 w-full" /><div className="skeleton h-4 w-4/5" /><div className="skeleton h-4 w-3/5" /></div>
        ) : (
          <div className="text-ink text-[15px] leading-relaxed">{children}</div>
        )}
      </div>
    </div>
  );
}

export function Spinner({ className }: { className?: string }) {
  return <Loader2 className={clsx("size-5 animate-spin text-ink-3", className)} />;
}

export const fmtMoney = (n: number | null | undefined) =>
  "$" + Number(n || 0).toLocaleString(undefined, { maximumFractionDigits: 0 });

export const fmtDate = (d: string | null | undefined, opts: Intl.DateTimeFormatOptions = { month: "short", day: "numeric" }) =>
  d ? new Date(d.length === 10 ? d + "T00:00:00" : d).toLocaleDateString(undefined, opts) : "—";

export const todayISO = () => new Date().toISOString().slice(0, 10);
