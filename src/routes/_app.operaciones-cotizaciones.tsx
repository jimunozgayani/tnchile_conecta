import { createFileRoute, Link } from "@tanstack/react-router";
import { pageHead } from "@/lib/page-head";
import { supabase } from "@/integrations/supabase/client";
import { useEffect, useState } from "react";
import { ClipboardList, RefreshCw, ExternalLink } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/operaciones-cotizaciones")({
  head: () => pageHead("/operaciones-cotizaciones", "Cotizaciones · Operaciones TN Chile", "Bandeja de cotizaciones enviadas por clientes: revisa carga, fotos, origen y destinos, y actualiza el estado de cada solicitud."),
  beforeLoad: async () => {
    const { redirect } = await import("@tanstack/react-router");
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw redirect({ to: "/login" });
    const { data: roles } = await supabase
      .from("user_roles").select("role").eq("user_id", user.id);
    const isAdmin = (roles ?? []).some((r: any) => r.role === "admin");
    if (!isAdmin) throw redirect({ to: "/dashboard" });
  },
  component: OpsCotizaciones,
});

const ESTADOS = ["pendiente", "en_revision", "cotizada", "aceptada", "rechazada", "cancelada"] as const;
const ESTADO_LABEL: Record<string, string> = {
  pendiente: "Pendiente", en_revision: "En revisión", cotizada: "Cotizada",
  aceptada: "Aceptada", rechazada: "Rechazada", cancelada: "Cancelada",
};

function OpsCotizaciones() {
  const [list, setList] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filtro, setFiltro] = useState<string>("all");

  const load = async () => {
    setLoading(true);
    let q = (supabase as any).from("cotizaciones").select("*").order("created_at", { ascending: false });
    if (filtro !== "all") q = q.eq("estado", filtro);
    const { data } = await q;
    setList(data ?? []);
    setLoading(false);
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [filtro]);

  const updateEstado = async (id: string, estado: string) => {
    const { error } = await (supabase as any).from("cotizaciones").update({ estado }).eq("id", id);
    if (error) { toast.error(error.message); return; }
    toast.success("Estado actualizado");
    load();
  };

  const saveNota = async (id: string, notas_admin: string) => {
    const { error } = await (supabase as any).from("cotizaciones").update({ notas_admin }).eq("id", id);
    if (error) { toast.error(error.message); return; }
    toast.success("Nota guardada");
  };

  const openPhoto = async (path: string) => {
    const { data, error } = await (supabase as any).storage.from("cotizacion-fotos").createSignedUrl(path, 3600);
    if (error || !data?.signedUrl) { toast.error("No se pudo abrir la foto"); return; }
    window.open(data.signedUrl, "_blank");
  };

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="rounded-md bg-primary-soft p-2"><ClipboardList className="h-5 w-5 text-primary" /></div>
          <div>
            <h1 className="text-2xl font-bold text-primary-dark">Cotizaciones</h1>
            <p className="text-sm text-muted-foreground">Solicitudes enviadas por clientes.</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <select value={filtro} onChange={(e) => setFiltro(e.target.value)}
            className="rounded-md border px-3 py-1.5 text-sm">
            <option value="all">Todos los estados</option>
            {ESTADOS.map((s) => <option key={s} value={s}>{ESTADO_LABEL[s]}</option>)}
          </select>
          <button onClick={load} className="inline-flex items-center gap-1 rounded-md border px-3 py-1.5 text-sm hover:bg-muted">
            <RefreshCw className="h-3.5 w-3.5" /> Refrescar
          </button>
          <Link to="/operaciones" className="text-sm text-primary hover:underline">← Operaciones</Link>
        </div>
      </header>

      {loading ? (
        <p className="text-sm text-muted-foreground">Cargando...</p>
      ) : list.length === 0 ? (
        <p className="rounded-xl border bg-card p-6 text-sm text-muted-foreground">Sin cotizaciones.</p>
      ) : (
        <ul className="space-y-3">
          {list.map((c) => {
            const destinos = Array.isArray(c.destinos) ? c.destinos : [];
            const fotos = Array.isArray(c.fotos) ? c.fotos : [];
            return (
              <li key={c.id} className="rounded-xl border bg-card p-4 shadow-sm">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-primary-dark">
                      {c.contacto_nombre} · {c.origen} → {destinos.join(" · ") || "—"}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(c.created_at).toLocaleString("es-CL")}
                      {c.contacto_telefono ? ` · ☎ ${c.contacto_telefono}` : ""}
                      {c.contacto_email ? ` · ✉ ${c.contacto_email}` : ""}
                    </p>
                    <p className="mt-1 text-sm">
                      {c.tipo_camion ? `${c.tipo_camion} · ` : ""}
                      {c.modalidad === "consolidado" ? "Consolidado" : "Camión completo"}
                      {c.peso_kg ? ` · ${c.peso_kg} kg` : ""}
                      {c.largo_cm || c.ancho_cm || c.alto_cm
                        ? ` · ${c.largo_cm ?? "?"}×${c.ancho_cm ?? "?"}×${c.alto_cm ?? "?"} cm`
                        : ""}
                      {c.fecha_despacho ? ` · Despacho ${c.fecha_despacho}` : ""}
                    </p>
                  </div>
                  <select
                    value={c.estado}
                    onChange={(e) => updateEstado(c.id, e.target.value)}
                    className="rounded-md border px-2 py-1 text-sm"
                  >
                    {ESTADOS.map((s) => <option key={s} value={s}>{ESTADO_LABEL[s]}</option>)}
                  </select>
                </div>

                {fotos.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {fotos.map((p: string, i: number) => (
                      <button key={i} onClick={() => openPhoto(p)}
                        className="inline-flex items-center gap-1 rounded-md border px-2 py-1 text-xs hover:bg-muted">
                        <ExternalLink className="h-3 w-3" /> Foto {i + 1}
                      </button>
                    ))}
                  </div>
                )}

                <NotaAdmin id={c.id} initial={c.notas_admin ?? ""} onSave={saveNota} />
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function NotaAdmin({ id, initial, onSave }: { id: string; initial: string; onSave: (id: string, v: string) => void }) {
  const [val, setVal] = useState(initial);
  return (
    <div className="mt-3">
      <label className="mb-1 block text-xs font-medium text-muted-foreground">Nota para el cliente</label>
      <div className="flex gap-2">
        <textarea
          value={val}
          onChange={(e) => setVal(e.target.value)}
          className="flex-1 rounded-md border px-2 py-1 text-sm"
          rows={2}
        />
        <button onClick={() => onSave(id, val)}
          className="rounded-md bg-primary px-3 py-1 text-sm text-primary-foreground hover:bg-primary-dark">
          Guardar
        </button>
      </div>
    </div>
  );
}
