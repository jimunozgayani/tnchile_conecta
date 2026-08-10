import { useEffect, useMemo, useState } from "react";

/**
 * Badge de cuenta regresiva para la exploración de proveedores.
 * Es solo una señal visual: no cierra ni transiciona la exploración.
 */
export function CountdownBadge({
  limiteAt,
  abiertaAt,
  className = "",
}: {
  limiteAt: string | null | undefined;
  abiertaAt?: string | null;
  className?: string;
}) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(t);
  }, []);

  const info = useMemo(() => {
    if (!limiteAt) return null;
    const limite = new Date(limiteAt).getTime();
    if (!Number.isFinite(limite)) return null;
    const restanteMs = limite - now;
    const inicio = abiertaAt ? new Date(abiertaAt).getTime() : NaN;
    const totalMs = Number.isFinite(inicio) ? limite - inicio : NaN;
    const ratio = Number.isFinite(totalMs) && totalMs > 0 ? restanteMs / totalMs : null;
    return { restanteMs, ratio };
  }, [limiteAt, abiertaAt, now]);

  if (!info) return null;

  const { restanteMs, ratio } = info;
  const abs = Math.abs(restanteMs);
  const h = Math.floor(abs / 3_600_000);
  const m = Math.floor((abs % 3_600_000) / 60_000);

  if (restanteMs <= 0) {
    return (
      <span
        className={`inline-flex items-center gap-1 rounded-full bg-destructive/15 px-2 py-0.5 text-xs font-semibold text-destructive ${className}`}
      >
        ⏱ Tiempo vencido hace {h > 0 ? `${h}h` : `${m}m`}
      </span>
    );
  }

  const pct = ratio ?? 1;
  const cls =
    pct > 0.5
      ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
      : pct >= 0.25
        ? "bg-amber-500/15 text-amber-600 dark:text-amber-400"
        : "bg-destructive/15 text-destructive animate-pulse";

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold ${cls} ${className}`}
    >
      ⏱ {h > 0 ? `${h}h ${m}m` : `${m}m`} restantes
    </span>
  );
}
