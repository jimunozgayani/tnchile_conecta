import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { Plus, Trash2, RotateCcw, AlertTriangle, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_app/disponibilidad")({
  component: DisponibilidadPage,
});

type LoadStatus = "consolidando" | "rampla_completa";
type Row = {
  id: string;
  name: string | null;
  truck_type: string | null;
  location: string | null;
  destination: string | null;
  load_status: LoadStatus;
  availability: number[]; // length 7, values 0|1|2
};

const DAYS = ["L", "M", "M", "J", "V", "S", "D"] as const;
const DAY_FULL = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"];

// JS: Sun=0..Sat=6 → our index: Mon=0..Sun=6
const todayIdx = (() => {
  const d = new Date().getDay();
  return d === 0 ? 6 : d - 1;
})();

const STATE_CLASSES = [
  "bg-muted text-muted-foreground hover:bg-muted/70", // 0 sin confirmar
  "bg-emerald-600 text-white hover:bg-emerald-700",   // 1 disponible
  "bg-red-600 text-white hover:bg-red-700",           // 2 no disponible
];
const STATE_LABEL = ["sin confirmar", "disponible", "no disponible"];

function normalizeAvail(v: any): number[] {
  const arr = Array.isArray(v) ? v : [];
  return Array.from({ length: 7 }, (_, i) => {
    const n = Number(arr[i]);
    return n === 1 || n === 2 ? n : 0;
  });
}

function DisponibilidadPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [filter, setFilter] = useState<string>("__all__");
  const [savingIds, setSavingIds] = useState<Set<string>>(new Set());
  const [failed, setFailed] = useState<Map<string, { patch: Partial<Row> }>>(new Map());
  const pending = useRef<Map<string, Partial<Row>>>(new Map());
  const timers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setIsAdmin(false); return; }
      const { data } = await supabase.from("user_roles").select("role").eq("user_id", user.id);
      setIsAdmin((data ?? []).some((r: any) => r.role === "admin"));
    })();
  }, []);

  const load = async () => {
    setLoading(true);
    const { data, error } = await (supabase as any)
      .from("driver_availability")
      .select("*")
      .order("created_at", { ascending: true });
    if (error) toast.error("Error al cargar: " + error.message);
    setRows((data ?? []).map((d: any) => ({ ...d, availability: normalizeAvail(d.availability) })));
    setLoading(false);
  };

  useEffect(() => {
    if (isAdmin) load();
  }, [isAdmin]);

  const savingIdsRef = useRef<Set<string>>(new Set());
  useEffect(() => { savingIdsRef.current = savingIds; }, [savingIds]);

  // Realtime sync — merge per row; preserve rows with unsaved local edits
  useEffect(() => {
    if (!isAdmin) return;
    const applyRow = (incoming: any) => {
      const merged: Row = { ...incoming, availability: normalizeAvail(incoming.availability) };
      setRows((rs) => {
        const idx = rs.findIndex((r) => r.id === merged.id);
        if (idx === -1) return [...rs, merged];
        // Keep local row while user is typing or a save is in-flight.
        if (pending.current.has(merged.id) || savingIdsRef.current.has(merged.id)) return rs;
        const next = rs.slice();
        next[idx] = merged;
        return next;
      });
    };
    const ch = (supabase as any)
      .channel("driver_availability_rt")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "driver_availability" }, (p: any) => applyRow(p.new))
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "driver_availability" }, (p: any) => applyRow(p.new))
      .on("postgres_changes", { event: "DELETE", schema: "public", table: "driver_availability" }, (p: any) => {
        const id = p.old?.id;
        if (!id || pending.current.has(id) || savingIdsRef.current.has(id)) return;
        setRows((rs) => rs.filter((r) => r.id !== id));
      })
      .subscribe();
    return () => { (supabase as any).removeChannel(ch); };
  }, [isAdmin]);

  const flush = async (id: string) => {
    const patch = pending.current.get(id);
    if (!patch) return;
    pending.current.delete(id);
    setSavingIds((s) => new Set(s).add(id));
    const { error } = await (supabase as any).from("driver_availability").update(patch).eq("id", id);
    setSavingIds((s) => { const n = new Set(s); n.delete(id); return n; });
    if (error) {
      setFailed((m) => new Map(m).set(id, { patch }));
      toast.error("No se pudo guardar", {
        description: error.message,
        action: { label: "Reintentar", onClick: () => retry(id) },
      });
    } else {
      setFailed((m) => { const n = new Map(m); n.delete(id); return n; });
    }
  };

  const retry = async (id: string) => {
    const f = failed.get(id);
    if (!f) return;
    pending.current.set(id, { ...(pending.current.get(id) ?? {}), ...f.patch });
    await flush(id);
  };

  const scheduleSave = (id: string, patch: Partial<Row>, immediate = false) => {
    pending.current.set(id, { ...(pending.current.get(id) ?? {}), ...patch });
    const t = timers.current.get(id);
    if (t) clearTimeout(t);
    if (immediate) { void flush(id); return; }
    timers.current.set(id, setTimeout(() => { void flush(id); }, 500));
  };

  const updateLocal = (id: string, patch: Partial<Row>) => {
    setRows((rs) => rs.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  };

  const onField = (id: string, key: "name" | "truck_type" | "location" | "destination", value: string) => {
    updateLocal(id, { [key]: value } as any);
    scheduleSave(id, { [key]: value || null } as any);
  };

  const toggleLoad = (row: Row) => {
    const next: LoadStatus = row.load_status === "consolidando" ? "rampla_completa" : "consolidando";
    updateLocal(row.id, { load_status: next });
    scheduleSave(row.id, { load_status: next }, true);
  };

  const cycleDay = (row: Row, dayIdx: number) => {
    const av = [...row.availability];
    av[dayIdx] = ((av[dayIdx] + 1) % 3) as 0 | 1 | 2;
    updateLocal(row.id, { availability: av });
    scheduleSave(row.id, { availability: av }, true);
  };

  const addDriver = async () => {
    const { data, error } = await (supabase as any)
      .from("driver_availability")
      .insert({})
      .select()
      .single();
    if (error) return toast.error("No se pudo agregar: " + error.message);
    setRows((rs) => [...rs, { ...data, availability: normalizeAvail(data.availability) }]);
    toast.success("Chofer agregado");
  };

  const removeDriver = async (id: string) => {
    if (!confirm("¿Eliminar este chofer?")) return;
    const prev = rows;
    setRows((rs) => rs.filter((r) => r.id !== id));
    const { error } = await (supabase as any).from("driver_availability").delete().eq("id", id);
    if (error) { setRows(prev); toast.error("No se pudo eliminar: " + error.message); }
  };

  const resetWeek = async () => {
    if (!confirm("¿Reiniciar la disponibilidad de todos los choferes esta semana?")) return;
    const zero = [0, 0, 0, 0, 0, 0, 0];
    const ids = rows.map((r) => r.id);
    setRows((rs) => rs.map((r) => ({ ...r, availability: zero.slice() })));
    const { error } = await (supabase as any)
      .from("driver_availability")
      .update({ availability: zero })
      .in("id", ids);
    if (error) toast.error("No se pudo reiniciar: " + error.message);
    else toast.success("Semana reiniciada");
  };

  // Chips
  const chips = useMemo(() => {
    const counts = new Map<string, number>();
    for (const r of rows) {
      const k = (r.truck_type || "").trim();
      if (!k) continue;
      counts.set(k, (counts.get(k) ?? 0) + 1);
    }
    return Array.from(counts.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  }, [rows]);

  const visibleRows = useMemo(() => {
    if (filter === "__all__") return rows;
    return rows.filter((r) => (r.truck_type || "").trim() === filter);
  }, [rows, filter]);

  // Today banner
  const availableToday = rows.filter((r) => r.availability[todayIdx] === 1);

  if (isAdmin === null) {
    return <div className="flex h-64 items-center justify-center text-muted-foreground">Verificando permisos…</div>;
  }
  if (isAdmin === false) {
    return (
      <div className="rounded-xl border bg-card p-6 text-center">
        <AlertTriangle className="mx-auto mb-3 h-8 w-8 text-warning" />
        <h2 className="text-lg font-semibold">Acceso restringido</h2>
        <p className="text-sm text-muted-foreground">Esta vista es solo para el equipo operativo (rol admin).</p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Banner */}
      <div className="rounded-2xl border-2 border-emerald-700/30 bg-gradient-to-br from-emerald-700 to-emerald-900 p-5 text-white shadow-md">
        <div className="flex items-baseline justify-between gap-3">
          <div>
            <div className="text-xs uppercase tracking-wider text-white/70">Hoy · {DAY_FULL[todayIdx]}</div>
            <div className="mt-1 text-3xl font-bold md:text-4xl">
              {availableToday.length} <span className="text-white/80 text-xl font-medium">disponibles</span>
              <span className="text-white/60 text-base font-normal"> de {rows.length}</span>
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={addDriver}
              className="inline-flex items-center gap-1 rounded-lg bg-amber-500 px-3 py-2 text-sm font-semibold text-slate-900 hover:bg-amber-400">
              <Plus className="h-4 w-4" /> Agregar
            </button>
            <button onClick={resetWeek}
              className="inline-flex items-center gap-1 rounded-lg bg-slate-800/60 px-3 py-2 text-sm font-medium text-white hover:bg-slate-800">
              <RotateCcw className="h-4 w-4" /> Reiniciar semana
            </button>
          </div>
        </div>
        {availableToday.length > 0 && (
          <ul className="mt-4 grid grid-cols-1 gap-2 md:grid-cols-2 lg:grid-cols-3">
            {availableToday.map((r) => (
              <li key={r.id} className="rounded-lg bg-white/10 px-3 py-2 text-sm">
                <div className="font-semibold">{r.name || "Sin nombre"}</div>
                <div className="text-xs text-white/80">
                  {[r.truck_type, r.location && `📍 ${r.location}`, r.destination && `→ ${r.destination}`]
                    .filter(Boolean).join(" · ") || "—"}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Chips */}
      <div className="flex flex-wrap gap-2">
        <Chip active={filter === "__all__"} onClick={() => setFilter("__all__")}
          label="Todos" count={rows.length} />
        {chips.map(([type, count]) => (
          <Chip key={type} active={filter === type} onClick={() => setFilter(type)}
            label={type} count={count} />
        ))}
      </div>

      {/* Table (desktop) / Cards (mobile) */}
      {loading ? (
        <div className="flex h-40 items-center justify-center text-muted-foreground">
          <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Cargando…
        </div>
      ) : visibleRows.length === 0 ? (
        <div className="rounded-xl border bg-card p-8 text-center text-muted-foreground">
          Aún no hay choferes. Toca <b>Agregar</b> para empezar.
        </div>
      ) : (
        <>
          {/* Desktop table */}
          <div className="hidden overflow-x-auto rounded-xl border bg-card shadow-sm md:block">
            <table className="w-full min-w-[900px] text-sm">
              <thead className="bg-slate-100 text-xs uppercase tracking-wider text-slate-600">
                <tr>
                  <Th>Chofer</Th>
                  <Th>Tipo camión</Th>
                  <Th>Lugar</Th>
                  <Th>Destino</Th>
                  <Th>Carga</Th>
                  {DAYS.map((d, i) => (
                    <th key={i} className={`px-2 py-2 text-center font-semibold ${i === todayIdx ? "bg-amber-100 text-amber-900" : ""}`}>
                      {d}
                    </th>
                  ))}
                  <Th> </Th>
                </tr>
              </thead>
              <tbody>
                {visibleRows.map((r) => (
                  <tr key={r.id} className="border-t align-middle hover:bg-slate-50/50">
                    <Td><CellInput value={r.name ?? ""} onChange={(v) => onField(r.id, "name", v)} placeholder="Nombre" /></Td>
                    <Td><CellInput value={r.truck_type ?? ""} onChange={(v) => onField(r.id, "truck_type", v)} placeholder="Tipo" /></Td>
                    <Td><CellInput value={r.location ?? ""} onChange={(v) => onField(r.id, "location", v)} placeholder="Lugar" /></Td>
                    <Td><CellInput value={r.destination ?? ""} onChange={(v) => onField(r.id, "destination", v)} placeholder="Destino" /></Td>
                    <Td>
                      <button onClick={() => toggleLoad(r)}
                        className={`rounded-md px-2 py-1 text-xs font-semibold ${
                          r.load_status === "rampla_completa" ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-800"
                        }`}>
                        {r.load_status === "rampla_completa" ? "Rampla completa" : "Consolidando"}
                      </button>
                    </Td>
                    {r.availability.map((v, i) => (
                      <td key={i} className={`px-2 py-2 text-center ${i === todayIdx ? "bg-amber-50" : ""}`}>
                        <button
                          onClick={() => cycleDay(r, i)}
                          aria-label={`${DAY_FULL[i]}: ${STATE_LABEL[v]}`}
                          title={`${DAY_FULL[i]}: ${STATE_LABEL[v]}`}
                          className={`h-9 w-9 rounded-md text-xs font-bold transition ${STATE_CLASSES[v]}`}>
                          {v === 0 ? "·" : v === 1 ? "✓" : "✗"}
                        </button>
                      </td>
                    ))}
                    <Td>
                      <div className="flex items-center justify-end gap-2">
                        {savingIds.has(r.id) && <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />}
                        {failed.has(r.id) && (
                          <button onClick={() => retry(r.id)} className="text-xs text-destructive underline">Reintentar</button>
                        )}
                        <button onClick={() => removeDriver(r.id)} className="text-destructive hover:text-red-700">
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile cards */}
          <div className="space-y-3 md:hidden">
            {visibleRows.map((r) => (
              <div key={r.id} className="rounded-xl border bg-card p-3 shadow-sm">
                <div className="grid grid-cols-2 gap-2">
                  <CellInput value={r.name ?? ""} onChange={(v) => onField(r.id, "name", v)} placeholder="Nombre" />
                  <CellInput value={r.truck_type ?? ""} onChange={(v) => onField(r.id, "truck_type", v)} placeholder="Tipo camión" />
                  <CellInput value={r.location ?? ""} onChange={(v) => onField(r.id, "location", v)} placeholder="Lugar" />
                  <CellInput value={r.destination ?? ""} onChange={(v) => onField(r.id, "destination", v)} placeholder="Destino" />
                </div>
                <div className="mt-2 flex items-center justify-between gap-2">
                  <button onClick={() => toggleLoad(r)}
                    className={`rounded-md px-3 py-1.5 text-xs font-semibold ${
                      r.load_status === "rampla_completa" ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-800"
                    }`}>
                    {r.load_status === "rampla_completa" ? "Rampla completa" : "Consolidando"}
                  </button>
                  <div className="flex items-center gap-2">
                    {savingIds.has(r.id) && <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />}
                    {failed.has(r.id) && (
                      <button onClick={() => retry(r.id)} className="text-xs text-destructive underline">Reintentar</button>
                    )}
                    <button onClick={() => removeDriver(r.id)} className="text-destructive">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
                <div className="mt-3 grid grid-cols-7 gap-1">
                  {r.availability.map((v, i) => (
                    <div key={i} className={`flex flex-col items-center rounded-md p-1 ${i === todayIdx ? "bg-amber-100" : ""}`}>
                      <div className={`text-[10px] font-semibold ${i === todayIdx ? "text-amber-900" : "text-muted-foreground"}`}>{DAYS[i]}</div>
                      <button
                        onClick={() => cycleDay(r, i)}
                        aria-label={`${DAY_FULL[i]}: ${STATE_LABEL[v]}`}
                        className={`mt-1 h-10 w-full rounded-md text-sm font-bold ${STATE_CLASSES[v]}`}>
                        {v === 0 ? "·" : v === 1 ? "✓" : "✗"}
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function Chip({ active, onClick, label, count }: { active: boolean; onClick: () => void; label: string; count: number }) {
  return (
    <button onClick={onClick}
      className={`rounded-full border px-3 py-1.5 text-sm font-medium transition ${
        active ? "border-emerald-700 bg-emerald-700 text-white" : "border-border bg-card hover:bg-muted"
      }`}>
      {label} <span className={`ml-1 text-xs ${active ? "text-white/80" : "text-muted-foreground"}`}>({count})</span>
    </button>
  );
}

function Th({ children }: { children: React.ReactNode }) {
  return <th className="px-3 py-2 text-left font-semibold">{children}</th>;
}
function Td({ children }: { children: React.ReactNode }) {
  return <td className="px-3 py-2">{children}</td>;
}

function CellInput({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <input
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className="w-full rounded-md border border-transparent bg-transparent px-2 py-1.5 text-sm focus:border-input focus:bg-background focus:outline-none focus:ring-1 focus:ring-primary"
    />
  );
}
