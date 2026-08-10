import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ChevronDown, ChevronRight, XCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { nombresAsignados } from "@/lib/solicitudes.functions";
import { fmtFechaES, primerDestinoOf } from "@/components/CotizacionDrawer";

type Rechazada = {
  id: string;
  contacto_nombre: string | null;
  origen: string | null;
  destinos: unknown;
  asignado_a: string | null;
  rechazada_at: string | null;
  comentarios_rechazo: string | null;
  revision_count: number | null;
};

/** Tabla de solo lectura de cotizaciones rechazadas (lider_cuenta y admin). */
export function RechazadasTable() {
  const [desde, setDesde] = useState("");
  const [hasta, setHasta] = useState("");

  const listQuery = useQuery({
    queryKey: ["cotizaciones-rechazadas", desde, hasta],
    queryFn: async () => {
      let q = supabase
        .from("cotizaciones")
        .select(
          "id, contacto_nombre, origen, destinos, asignado_a, rechazada_at, comentarios_rechazo, revision_count",
        )
        .eq("estado", "rechazada")
        .order("rechazada_at", { ascending: false })
        .limit(300);
      if (desde) q = q.gte("rechazada_at", desde);
      if (hasta) q = q.lte("rechazada_at", `${hasta}T23:59:59`);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as Rechazada[];
    },
  });

  const rows = listQuery.data ?? [];
  const ids = useMemo(
    () => [...new Set(rows.map((r) => r.asignado_a).filter((v): v is string => !!v))],
    [rows],
  );
  const nombresFn = useServerFn(nombresAsignados);
  const nombresQuery = useQuery({
    queryKey: ["rechazadas-nombres", ids],
    queryFn: () => nombresFn({ data: { ids } }),
    enabled: ids.length > 0,
  });
  const nombres = nombresQuery.data ?? {};

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-end gap-3">
        <div>
          <label className="mb-1 block text-xs font-medium text-muted-foreground" htmlFor="rech-desde">
            Rechazo desde
          </label>
          <input
            id="rech-desde"
            type="date"
            value={desde}
            onChange={(e) => setDesde(e.target.value)}
            className="rounded-md border bg-background px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-muted-foreground" htmlFor="rech-hasta">
            Rechazo hasta
          </label>
          <input
            id="rech-hasta"
            type="date"
            value={hasta}
            onChange={(e) => setHasta(e.target.value)}
            className="rounded-md border bg-background px-3 py-2 text-sm"
          />
        </div>
      </div>

      {listQuery.isLoading ? (
        <div className="h-24 animate-pulse rounded-md bg-muted" />
      ) : rows.length === 0 ? (
        <p className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">
          No hay cotizaciones rechazadas
        </p>
      ) : (
        <div className="overflow-x-auto rounded-md border">
          <table className="w-full min-w-[760px] text-sm">
            <thead className="bg-muted/50 text-xs uppercase text-muted-foreground">
              <tr>
                <th className="px-3 py-2 text-left font-medium">Contacto</th>
                <th className="px-3 py-2 text-left font-medium">Ruta</th>
                <th className="px-3 py-2 text-left font-medium">Asignado a</th>
                <th className="px-3 py-2 text-left font-medium">Fecha rechazo</th>
                <th className="px-3 py-2 text-left font-medium">Motivo</th>
                <th className="px-3 py-2 text-right font-medium">Revisiones previas</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {rows.map((r) => (
                <tr key={r.id}>
                  <td className="px-3 py-2 font-medium">{r.contacto_nombre ?? "Sin contacto"}</td>
                  <td className="px-3 py-2 text-muted-foreground">
                    {r.origen ?? "—"} → {primerDestinoOf(r.destinos)}
                  </td>
                  <td className="px-3 py-2 text-muted-foreground">
                    {r.asignado_a ? nombres[r.asignado_a] || "Asignada" : "Sin asignar"}
                  </td>
                  <td className="px-3 py-2 tabular-nums text-muted-foreground">
                    {fmtFechaES(r.rechazada_at)}
                  </td>
                  <td className="max-w-[280px] px-3 py-2 text-xs text-muted-foreground">
                    {r.comentarios_rechazo ?? "—"}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">{r.revision_count ?? 0}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

/** Sección colapsable para el panel del líder de cuenta. */
export function RechazadasSection() {
  const [open, setOpen] = useState(false);
  return (
    <section aria-label="Cotizaciones rechazadas" className="rounded-lg border bg-card">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-2 px-5 py-3 text-left"
      >
        <span className="flex items-center gap-2 text-sm font-semibold">
          <XCircle className="h-4 w-4 text-destructive" aria-hidden="true" /> Cotizaciones rechazadas
        </span>
        {open ? (
          <ChevronDown className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
        ) : (
          <ChevronRight className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
        )}
      </button>
      {open && (
        <div className="border-t p-5">
          <RechazadasTable />
        </div>
      )}
    </section>
  );
}
