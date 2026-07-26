import { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

export type DayEntry = {
  id: string;
  nombre: string;
  tipo: string | null;
  lugar: string | null;
  destino: string | null;
};

export type DayData = {
  /** drivers with estado = 'disponible' that day */
  disponibles: DayEntry[];
  /** rows that exist but are not 'disponible' (no_disponible) */
  otros: number;
};

const MONTHS = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];
const DOW = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];

export function toISODate(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${dd}`;
}

/** Mon-first grid covering the whole month (6 rows max, trailing weeks trimmed). */
export function monthGrid(year: number, month: number): Date[] {
  const first = new Date(year, month, 1);
  const offset = (first.getDay() + 6) % 7; // Mon = 0
  const start = new Date(year, month, 1 - offset);
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const total = Math.ceil((offset + daysInMonth) / 7) * 7;
  return Array.from({ length: total }, (_, i) => {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    return d;
  });
}

/** Green intensity scaling with the number of available drivers. */
function badgeClasses(count: number) {
  if (count >= 8) return "bg-emerald-700 text-white";
  if (count >= 5) return "bg-emerald-600 text-white";
  if (count >= 3) return "bg-emerald-500 text-white";
  return "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/60 dark:text-emerald-100";
}

function cellTone(count: number) {
  if (count >= 8) return "bg-emerald-100/90 dark:bg-emerald-900/40";
  if (count >= 5) return "bg-emerald-50 dark:bg-emerald-900/30";
  if (count >= 1) return "bg-emerald-50/60 dark:bg-emerald-900/20";
  return "bg-muted/30";
}

export function MonthCalendar({
  year,
  month,
  selected,
  today,
  dataByDate,
  onSelect,
  onMonthChange,
  onToday,
}: {
  year: number;
  month: number;
  selected: string;
  today: string;
  dataByDate: Map<string, DayData>;
  onSelect: (iso: string) => void;
  onMonthChange: (year: number, month: number) => void;
  onToday: () => void;
}) {
  const cells = monthGrid(year, month);
  const [canHover, setCanHover] = useState(false);
  const [hovered, setHovered] = useState<string | null>(null);

  useEffect(() => {
    setCanHover(window.matchMedia("(hover: hover) and (pointer: fine)").matches);
  }, []);

  const shift = (delta: number) => {
    const d = new Date(year, month + delta, 1);
    onMonthChange(d.getFullYear(), d.getMonth());
  };

  return (
    <section aria-label="Calendario mensual de disponibilidad" className="rounded-xl border bg-card p-3 shadow-sm sm:p-4">
      <div className="mb-3 flex items-center justify-between gap-2">
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => shift(-1)}
            aria-label="Mes anterior"
            className="rounded-md p-1.5 text-muted-foreground transition hover:bg-muted hover:text-primary"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
          <h2 className="min-w-[9.5rem] text-center text-base font-bold text-primary-dark sm:text-lg">
            {MONTHS[month]} {year}
          </h2>
          <button
            type="button"
            onClick={() => shift(1)}
            aria-label="Mes siguiente"
            className="rounded-md p-1.5 text-muted-foreground transition hover:bg-muted hover:text-primary"
          >
            <ChevronRight className="h-5 w-5" />
          </button>
        </div>
        <button
          type="button"
          onClick={onToday}
          className="rounded-md border border-primary/40 px-3 py-1.5 text-xs font-semibold text-primary transition hover:bg-primary/10"
        >
          Hoy
        </button>
      </div>

      <div className="grid grid-cols-7 gap-1 text-center text-[10px] font-semibold uppercase text-muted-foreground sm:text-xs">
        {DOW.map((d) => (
          <div key={d} className="py-1">{d}</div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-1">
        {cells.map((d) => {
          const iso = toISODate(d);
          const inMonth = d.getMonth() === month;
          const data = dataByDate.get(iso);
          const count = data?.disponibles.length ?? 0;
          const isToday = iso === today;
          const isSelected = iso === selected;
          return (
            <div key={iso} className="relative">
              <button
                type="button"
                onClick={() => onSelect(iso)}
                onMouseEnter={canHover ? () => setHovered(iso) : undefined}
                onMouseLeave={canHover ? () => setHovered((h) => (h === iso ? null : h)) : undefined}
                aria-pressed={isSelected}
                aria-label={`${d.getDate()} de ${MONTHS[d.getMonth()]}: ${count} chofer(es) disponible(s)`}
                className={[
                  "flex h-16 w-full flex-col items-start gap-1 rounded-lg border p-1.5 text-left transition sm:h-20 sm:p-2",
                  cellTone(count),
                  inMonth ? "" : "opacity-40",
                  isToday ? "border-2 border-primary" : "border-border",
                  isSelected ? "ring-2 ring-offset-1 ring-primary-dark" : "",
                ].join(" ")}
              >
                <span className={`text-xs font-semibold sm:text-sm ${isToday ? "text-primary" : "text-foreground"}`}>
                  {d.getDate()}
                </span>
                {count > 0 ? (
                  <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold ${badgeClasses(count)}`}>
                    {count}
                  </span>
                ) : (
                  <span className="text-[10px] text-muted-foreground">
                    {data?.otros ? "—" : ""}
                  </span>
                )}
              </button>

              {canHover && hovered === iso && count > 0 && (
                <div
                  role="tooltip"
                  className="pointer-events-none absolute left-1/2 top-full z-30 mt-1 w-64 -translate-x-1/2 rounded-lg border bg-popover p-2 text-left text-[11px] shadow-lg"
                >
                  <div className="mb-1 font-semibold text-foreground">
                    {count} disponible{count === 1 ? "" : "s"}
                  </div>
                  <ul className="space-y-0.5 text-muted-foreground">
                    {data!.disponibles.slice(0, 5).map((e) => (
                      <li key={e.id} className="truncate">
                        <span className="font-medium text-foreground">{e.nombre}</span>
                        {e.tipo ? ` — ${e.tipo}` : ""}
                        {e.lugar || e.destino
                          ? ` — ${e.lugar ?? "?"} → ${e.destino ?? "?"}`
                          : ""}
                      </li>
                    ))}
                  </ul>
                  {count > 5 && (
                    <div className="mt-1 font-medium text-primary">+{count - 5} más</div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
