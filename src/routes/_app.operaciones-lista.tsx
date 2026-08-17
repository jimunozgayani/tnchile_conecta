import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";
import { listarMisOperaciones, type OperacionLista } from "@/lib/operaciones.functions";
import { pageHead } from "@/lib/page-head";
import { requireOperations } from "@/lib/require-admin";
import { CheckCircle2, LayoutGrid, List, Loader2, MapPin, Search, AlertTriangle } from "lucide-react";

export const Route = createFileRoute("/_app/operaciones-lista")({
  head: () =>
    pageHead(
      "/operaciones-lista",
      "Mis Operaciones · TN Chile Conecta",
      "Tablero Kanban y listado de operaciones TN Chile por estado, con filtros por cliente, fecha de carga y asignación de chofer.",
    ),
  // Supabase session lives in localStorage; gate must run client-side only.
  ssr: false,
  beforeLoad: requireOperations,
  component: MisOperacionesPage,
});

const COLUMNAS = [
  { estado: "lista_para_operar", label: "Lista para operar" },
  { estado: "confirmada", label: "Confirmada" },
  { estado: "en_operacion", label: "En operación" },
  { estado: "finalizada", label: "Finalizada" },
  { estado: "cobro_pendiente", label: "Cobro pendiente" },
  { estado: "cerrada", label: "Cerrada" },
] as const;

const LABEL: Record<string, string> = Object.fromEntries(COLUMNAS.map((c) => [c.estado, c.label]));

type SortKey = "numero_operacion" | "contacto_nombre" | "ruta" | "estado" | "chofer" | "fecha_carga";

function ruta(o: OperacionLista) {
  return `${o.origen ?? "—"} → ${o.destino ?? "—"}`;
}
function fmtFecha(v: string | null) {
  if (!v) return "—";
  const d = new Date(v);
  return isNaN(d.getTime()) ? v : d.toLocaleDateString("es-CL");
}

function ChoferTag({ o }: { o: OperacionLista }) {
  if (!o.asignacion_id) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-medium text-amber-900">
        <AlertTriangle className="h-3 w-3" /> Sin asignar
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-700">
      <CheckCircle2 className="h-3.5 w-3.5" /> {o.chofer_nombre ?? "Asignado"}
    </span>
  );
}

function MisOperacionesPage() {
  const listar = useServerFn(listarMisOperaciones);
  const { data, isLoading } = useQuery({
    queryKey: ["mis-operaciones"],
    queryFn: () => listar({}),
  });

  const [vista, setVista] = useState<"kanban" | "lista">("kanban");
  const [q, setQ] = useState("");
  const [desde, setDesde] = useState("");
  const [hasta, setHasta] = useState("");
  const [soloSinAsignar, setSoloSinAsignar] = useState(false);
  const [sort, setSort] = useState<{ key: SortKey; dir: 1 | -1 }>({ key: "fecha_carga", dir: 1 });

  const filtradas = useMemo(() => {
    const term = q.trim().toLowerCase();
    return (data ?? []).filter((o) => {
      if (term && !(o.contacto_nombre ?? "").toLowerCase().includes(term)) return false;
      if (soloSinAsignar && o.asignacion_id) return false;
      if (desde && (!o.fecha_carga || o.fecha_carga < desde)) return false;
      if (hasta && (!o.fecha_carga || o.fecha_carga > hasta)) return false;
      return true;
    });
  }, [data, q, desde, hasta, soloSinAsignar]);

  const ordenadas = useMemo(() => {
    const val = (o: OperacionLista): string | number => {
      switch (sort.key) {
        case "numero_operacion":
          return o.numero_operacion;
        case "contacto_nombre":
          return (o.contacto_nombre ?? "").toLowerCase();
        case "ruta":
          return ruta(o).toLowerCase();
        case "estado":
          return LABEL[o.estado] ?? o.estado;
        case "chofer":
          return o.asignacion_id ? (o.chofer_nombre ?? "zz").toLowerCase() : "zzz";
        default:
          return o.fecha_carga ?? "9999-12-31";
      }
    };
    return [...filtradas].sort((a, b) => {
      const va = val(a);
      const vb = val(b);
      if (va === vb) return 0;
      return (va > vb ? 1 : -1) * sort.dir;
    });
  }, [filtradas, sort]);

  const navigate = useNavigate();
  const abrir = (id: string) => navigate({ to: "/operacion/$id", params: { id } });
  const toggleSort = (key: SortKey) =>
    setSort((s) => ({ key, dir: s.key === key && s.dir === 1 ? -1 : 1 }));

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-primary-dark">Mis Operaciones</h1>
          <p className="text-sm text-muted-foreground">
            {filtradas.length} operación{filtradas.length === 1 ? "" : "es"} visible
            {filtradas.length === 1 ? "" : "s"}.
          </p>
        </div>
        <div className="inline-flex rounded-full border bg-card p-1">
          <button
            onClick={() => setVista("kanban")}
            className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium transition ${
              vista === "kanban" ? "bg-primary text-primary-foreground" : "hover:bg-muted"
            }`}
          >
            <LayoutGrid className="h-4 w-4" /> Kanban
          </button>
          <button
            onClick={() => setVista("lista")}
            className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium transition ${
              vista === "lista" ? "bg-primary text-primary-foreground" : "hover:bg-muted"
            }`}
          >
            <List className="h-4 w-4" /> Lista
          </button>
        </div>
      </header>

      {/* Filtros */}
      <section className="flex flex-wrap items-end gap-3 rounded-xl border bg-card p-3 shadow-sm">
        <label className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Buscar cliente…"
            className="w-full rounded-md border bg-background pl-8 pr-3 py-2 text-sm"
          />
        </label>
        <label className="text-xs text-muted-foreground">
          Desde (carga)
          <input
            type="date"
            value={desde}
            onChange={(e) => setDesde(e.target.value)}
            className="mt-1 block rounded-md border bg-background px-2 py-1.5 text-sm text-foreground"
          />
        </label>
        <label className="text-xs text-muted-foreground">
          Hasta (carga)
          <input
            type="date"
            value={hasta}
            onChange={(e) => setHasta(e.target.value)}
            className="mt-1 block rounded-md border bg-background px-2 py-1.5 text-sm text-foreground"
          />
        </label>
        <button
          onClick={() => setSoloSinAsignar((v) => !v)}
          className={`rounded-full border px-3 py-1.5 text-sm font-medium transition ${
            soloSinAsignar ? "border-amber-400 bg-amber-100 text-amber-900" : "hover:bg-muted"
          }`}
        >
          Sin asignar
        </button>
        {(q || desde || hasta || soloSinAsignar) && (
          <button
            onClick={() => { setQ(""); setDesde(""); setHasta(""); setSoloSinAsignar(false); }}
            className="text-sm text-muted-foreground underline"
          >
            Limpiar
          </button>
        )}
      </section>

      {isLoading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Cargando operaciones…
        </div>
      ) : vista === "kanban" ? (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
          {COLUMNAS.map((col) => {
            const items = ordenadas.filter((o) => o.estado === col.estado);
            return (
              <div key={col.estado} className="rounded-xl border bg-muted/30 p-2">
                <div className="flex items-center justify-between px-1 pb-2">
                  <h2 className="text-sm font-semibold">{col.label}</h2>
                  <span className="rounded-full bg-background px-2 text-xs text-muted-foreground">{items.length}</span>
                </div>
                <div className="space-y-2">
                  {items.length === 0 && <p className="px-1 pb-2 text-xs text-muted-foreground">—</p>}
                  {items.map((o) => (
                    <button
                      key={o.id}
                      onClick={() => abrir(o.id)}
                      className="w-full rounded-lg border bg-card p-3 text-left shadow-sm transition hover:border-primary hover:shadow"
                    >
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-semibold text-primary">#{o.numero_operacion}</span>
                        <span className="text-muted-foreground">{fmtFecha(o.fecha_carga)}</span>
                      </div>
                      <p className="mt-1 truncate text-sm font-medium">{o.contacto_nombre ?? "Sin cliente"}</p>
                      <p className="mt-1 flex items-start gap-1 text-xs text-muted-foreground">
                        <MapPin className="mt-0.5 h-3 w-3 shrink-0 text-primary" />
                        <span className="line-clamp-2">{ruta(o)}</span>
                      </p>
                      <div className="mt-2">
                        <ChoferTag o={o} />
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border bg-card shadow-sm">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-left text-xs uppercase text-muted-foreground">
              <tr>
                {(
                  [
                    ["numero_operacion", "N°"],
                    ["contacto_nombre", "Cliente"],
                    ["ruta", "Ruta"],
                    ["estado", "Estado"],
                    ["chofer", "Chofer"],
                    ["fecha_carga", "Fecha carga"],
                  ] as [SortKey, string][]
                ).map(([key, label]) => (
                  <th key={key} className="px-3 py-2">
                    <button onClick={() => toggleSort(key)} className="inline-flex items-center gap-1 hover:text-foreground">
                      {label}
                      {sort.key === key && <span>{sort.dir === 1 ? "▲" : "▼"}</span>}
                    </button>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {ordenadas.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-3 py-6 text-center text-muted-foreground">
                    No hay operaciones con estos filtros.
                  </td>
                </tr>
              )}
              {ordenadas.map((o) => (
                <tr
                  key={o.id}
                  onClick={() => abrir(o.id)}
                  className="cursor-pointer border-t transition hover:bg-primary-soft/30"
                >
                  <td className="px-3 py-2 font-semibold text-primary">#{o.numero_operacion}</td>
                  <td className="px-3 py-2">{o.contacto_nombre ?? "—"}</td>
                  <td className="px-3 py-2 text-muted-foreground">{ruta(o)}</td>
                  <td className="px-3 py-2">
                    <span className="rounded-full bg-muted px-2 py-0.5 text-xs">{LABEL[o.estado] ?? o.estado}</span>
                  </td>
                  <td className="px-3 py-2"><ChoferTag o={o} /></td>
                  <td className="px-3 py-2 whitespace-nowrap">{fmtFecha(o.fecha_carga)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
