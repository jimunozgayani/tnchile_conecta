import { useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { AlertTriangle, Loader2, Plus, Target, X } from "lucide-react";
import { crearMeta, obtenerMetas, type Meta } from "@/lib/liderazgo.functions";
import { relativeDays } from "@/components/staff-home";

export function periodoActual(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export function mesLargo(): string {
  const s = new Date().toLocaleDateString("es-CL", { month: "long", year: "numeric" });
  return s.charAt(0).toUpperCase() + s.slice(1);
}

type Columna = { label: string; get: (row: never) => number };

export function TeamTable<T extends { user_id: string; nombre: string }>({
  titulo,
  filas,
  columnas,
  cargando,
}: {
  titulo: string;
  filas: T[];
  columnas: { label: string; get: (row: T) => number }[];
  cargando: boolean;
}) {
  const totales = columnas.map((c) => filas.reduce((acc, r) => acc + c.get(r), 0));

  return (
    <section className="rounded-xl border bg-card shadow-sm">
      <header className="border-b px-5 py-3">
        <h2 className="text-sm font-semibold">{titulo}</h2>
        <p className="text-xs text-muted-foreground">{mesLargo()}</p>
      </header>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b text-left text-xs uppercase tracking-wide text-muted-foreground">
              <th className="px-5 py-2 font-medium">Nombre</th>
              {columnas.map((c) => (
                <th key={c.label} className="px-3 py-2 text-right font-medium">
                  {c.label}
                </th>
              ))}
              <th className="px-5 py-2 text-right font-medium">Acción</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {cargando && (
              <tr>
                <td colSpan={columnas.length + 2} className="px-5 py-6 text-muted-foreground">
                  Cargando equipo…
                </td>
              </tr>
            )}
            {!cargando && filas.length === 0 && (
              <tr>
                <td colSpan={columnas.length + 2} className="px-5 py-6 text-muted-foreground">
                  Aún no hay miembros con este rol.
                </td>
              </tr>
            )}
            {filas.map((r) => (
              <tr key={r.user_id}>
                <td className="px-5 py-3 font-medium">{r.nombre}</td>
                {columnas.map((c) => (
                  <td key={c.label} className="px-3 py-3 text-right">
                    {c.get(r)}
                  </td>
                ))}
                <td className="px-5 py-3 text-right">
                  <button
                    type="button"
                    onClick={() => toast.info("El detalle por persona llega próximamente.")}
                    className="rounded-md border px-2.5 py-1 text-xs font-medium hover:bg-muted"
                  >
                    Ver detalle
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
          {filas.length > 0 && (
            <tfoot>
              <tr className="border-t bg-muted/40 text-sm font-semibold">
                <td className="px-5 py-3">Total del equipo</td>
                {totales.map((t, i) => (
                  <td key={i} className="px-3 py-3 text-right">
                    {t}
                  </td>
                ))}
                <td />
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </section>
  );
}

export function SinAsignarAlert({ count }: { count: number }) {
  if (count <= 0) return null;
  return (
    <div className="flex items-center justify-between gap-3 rounded-xl border border-amber-300 bg-amber-50 p-4 text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-100">
      <p className="flex items-center gap-2 text-sm font-medium">
        <AlertTriangle className="h-4 w-4" />
        Hay {count} {count === 1 ? "solicitud" : "solicitudes"} sin asignar
      </p>
      <Link to="/comercial-solicitudes" className="text-sm font-semibold underline">
        Revisar
      </Link>
    </div>
  );
}

export function ProgressBar({ meta }: { meta: Meta }) {
  const objetivo = Number(meta.valor_objetivo ?? 0);
  const actual = Number(meta.valor_actual ?? 0);
  const pct = objetivo > 0 ? Math.min(100, Math.round((actual / objetivo) * 100)) : 0;
  return (
    <div>
      <div className="flex items-baseline justify-between gap-3">
        <p className="text-sm font-medium">{meta.descripcion}</p>
        <p className="shrink-0 text-xs text-muted-foreground">
          {actual.toLocaleString("es-CL")} / {objetivo.toLocaleString("es-CL")}{" "}
          {meta.unidad ?? ""}
        </p>
      </div>
      <div className="mt-1.5 h-2 w-full overflow-hidden rounded-full bg-muted">
        <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

export function MetasEquipo({
  rol,
  puedeCrear,
}: {
  rol: "comercial" | "operador";
  puedeCrear: boolean;
}) {
  const periodo = useMemo(periodoActual, []);
  const qc = useQueryClient();
  const listar = useServerFn(obtenerMetas);
  const crear = useServerFn(crearMeta);
  const [open, setOpen] = useState(false);
  const [descripcion, setDescripcion] = useState("");
  const [objetivo, setObjetivo] = useState("");
  const [unidad, setUnidad] = useState<"operaciones" | "CLP" | "%">("operaciones");
  const [saving, setSaving] = useState(false);

  const { data: metas, isLoading } = useQuery({
    queryKey: ["metas", rol, periodo],
    queryFn: () => listar({ data: { rol, periodo } }),
  });

  async function guardar(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await crear({
        data: {
          rol,
          periodo,
          descripcion,
          valor_objetivo: Number(objetivo),
          unidad,
        },
      });
      toast.success("Meta creada.");
      setDescripcion("");
      setObjetivo("");
      setOpen(false);
      await qc.invalidateQueries({ queryKey: ["metas", rol, periodo] });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo crear la meta.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="rounded-xl border bg-card shadow-sm">
      <header className="flex items-center justify-between gap-3 border-b px-5 py-3">
        <h2 className="flex items-center gap-2 text-sm font-semibold">
          <Target className="h-4 w-4 text-primary" /> Metas del equipo · {periodo}
        </h2>
        {puedeCrear && (
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground hover:bg-primary-dark"
          >
            <Plus className="h-3.5 w-3.5" /> Agregar meta
          </button>
        )}
      </header>
      <div className="space-y-4 px-5 py-4">
        {isLoading && <p className="text-sm text-muted-foreground">Cargando metas…</p>}
        {!isLoading && (metas ?? []).filter((m) => !m.user_id).length === 0 && (
          <p className="text-sm text-muted-foreground">
            Aún no hay metas definidas para este período.
          </p>
        )}
        {(metas ?? []).filter((m) => !m.user_id).map((m) => (
          <ProgressBar key={m.id} meta={m} />
        ))}
      </div>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <form
            onSubmit={guardar}
            className="w-full max-w-md space-y-4 rounded-xl border bg-card p-5 shadow-lg"
          >
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold">Nueva meta del equipo</h3>
              <button type="button" onClick={() => setOpen(false)} aria-label="Cerrar">
                <X className="h-4 w-4 text-muted-foreground" />
              </button>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">
                Descripción
              </label>
              <input
                required
                value={descripcion}
                onChange={(e) => setDescripcion(e.target.value)}
                className="w-full rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                placeholder="Cerrar 20 operaciones en el mes"
              />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-xs font-medium text-muted-foreground">
                  Objetivo
                </label>
                <input
                  required
                  type="number"
                  min="1"
                  step="any"
                  value={objetivo}
                  onChange={(e) => setObjetivo(e.target.value)}
                  className="w-full rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-muted-foreground">
                  Unidad
                </label>
                <select
                  value={unidad}
                  onChange={(e) => setUnidad(e.target.value as typeof unidad)}
                  className="w-full rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                >
                  <option value="operaciones">operaciones</option>
                  <option value="CLP">CLP</option>
                  <option value="%">%</option>
                </select>
              </div>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">Período</label>
              <input
                readOnly
                value={periodo}
                className="w-full rounded-md border bg-muted px-3 py-2 text-sm text-muted-foreground"
              />
            </div>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-md border px-3 py-2 text-sm hover:bg-muted"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={saving}
                className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary-dark disabled:opacity-60"
              >
                {saving && <Loader2 className="h-4 w-4 animate-spin" />} Guardar
              </button>
            </div>
          </form>
        </div>
      )}
    </section>
  );
}

const ACCION_LABEL: Record<string, string> = {
  INSERT: "Creó un registro",
  UPDATE: "Actualizó un registro",
  DELETE: "Eliminó un registro",
  sellar_cierre: "Selló el cierre y creó la ficha",
  avanzar_estado: "Avanzó el estado de la operación",
  finalizar: "Finalizó la operación",
};

export function ActividadEquipoCard({
  filas,
  cargando,
}: {
  filas: { id: string; accion: string; usuario_email: string | null; created_at: string }[];
  cargando: boolean;
}) {
  return (
    <section className="rounded-xl border bg-card shadow-sm">
      <header className="border-b px-5 py-3">
        <h2 className="text-sm font-semibold">Actividad reciente del equipo</h2>
      </header>
      {cargando ? (
        <p className="px-5 py-6 text-sm text-muted-foreground">Cargando actividad…</p>
      ) : filas.length === 0 ? (
        <p className="px-5 py-6 text-sm text-muted-foreground">Sin movimientos registrados.</p>
      ) : (
        <ul className="divide-y">
          {filas.map((a) => (
            <li key={a.id} className="flex items-center justify-between gap-3 px-5 py-3">
              <div className="min-w-0">
                <p className="truncate text-sm">{ACCION_LABEL[a.accion] ?? a.accion}</p>
                <p className="truncate text-xs text-muted-foreground">
                  {a.usuario_email ?? "Sistema"}
                </p>
              </div>
              <span className="shrink-0 text-xs text-muted-foreground">
                {relativeDays(a.created_at)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export type { Columna };
