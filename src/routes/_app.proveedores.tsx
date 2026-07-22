import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Building2, Search, Filter, MapPin, Truck, Users, Loader2 } from "lucide-react";
import { pageHead } from "@/lib/page-head";
import { supabase } from "@/integrations/supabase/client";
import { REGIONES_CHILE } from "@/lib/regions";
import { listProveedoresDirectory, type ProveedorDirectoryRow } from "@/lib/proveedores-directory.functions";

export const Route = createFileRoute("/_app/proveedores")({
  head: () => pageHead(
    "/proveedores",
    "Directorio de proveedores · TN Chile",
    "Explora proveedores de transporte de TN Chile filtrando por región y estado de documentos para elegir el mejor aliado logístico."
  ),
  beforeLoad: async () => {
    const { redirect } = await import("@tanstack/react-router");
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw redirect({ to: "/login" });
    const { data: roles } = await supabase
      .from("user_roles").select("role").eq("user_id", user.id);
    const rs = (roles ?? []).map((r: any) => r.role);
    if (!rs.includes("cliente") && !rs.includes("admin")) {
      throw redirect({ to: "/dashboard" });
    }
  },
  component: ProveedoresDirectory,
});

const DOC_LABEL: Record<string, string> = {
  vigente: "Vigente",
  por_vencer: "Por vencer",
  vencido: "Vencido",
  sin_datos: "Sin datos",
};
const DOC_CLASS: Record<string, string> = {
  vigente: "bg-emerald-100 text-emerald-800 border-emerald-200",
  por_vencer: "bg-amber-100 text-amber-800 border-amber-200",
  vencido: "bg-red-100 text-red-800 border-red-200",
  sin_datos: "bg-zinc-100 text-zinc-600 border-zinc-200",
};

function docKey(r: ProveedorDirectoryRow) {
  return r.estado_doc ?? "sin_datos";
}

function ProveedoresDirectory() {
  const load = useServerFn(listProveedoresDirectory);
  const { data, isLoading, error } = useQuery({
    queryKey: ["proveedores-directory"],
    queryFn: () => load({}),
  });

  const [q, setQ] = useState("");
  const [region, setRegion] = useState<string>("todas");
  const [doc, setDoc] = useState<string>("todos");

  const rows = useMemo(() => {
    const list = data ?? [];
    const term = q.trim().toLowerCase();
    return list.filter((r) => {
      if (region !== "todas" && (r.region || "") !== region) return false;
      if (doc !== "todos" && docKey(r) !== doc) return false;
      if (term) {
        const hay = `${r.razon_social ?? ""} ${r.rut_empresa ?? ""} ${r.region ?? ""}`.toLowerCase();
        if (!hay.includes(term)) return false;
      }
      return true;
    }).sort((a, b) => (a.razon_social ?? "").localeCompare(b.razon_social ?? ""));
  }, [data, q, region, doc]);

  const totals = useMemo(() => {
    const list = data ?? [];
    return {
      total: list.length,
      vigente: list.filter((r) => docKey(r) === "vigente").length,
      por_vencer: list.filter((r) => docKey(r) === "por_vencer").length,
      vencido: list.filter((r) => docKey(r) === "vencido").length,
    };
  }, [data]);

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <header className="flex items-center gap-3">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary-soft">
          <Building2 className="h-6 w-6 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-primary-dark">Directorio de proveedores</h1>
          <p className="text-sm text-muted-foreground">
            Filtra por región y estado de documentos para encontrar transportistas disponibles.
          </p>
        </div>
      </header>

      <section className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard label="Proveedores" value={totals.total} tone="primary" />
        <StatCard label="Documentos vigentes" value={totals.vigente} tone="ok" />
        <StatCard label="Por vencer" value={totals.por_vencer} tone="warn" />
        <StatCard label="Vencidos" value={totals.vencido} tone="danger" />
      </section>

      <section className="rounded-lg border border-border bg-card p-4 shadow-sm">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
          <label className="relative md:col-span-2">
            <span className="sr-only">Buscar</span>
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Buscar por razón social, RUT o región…"
              className="w-full rounded-md border border-input bg-background py-2 pl-9 pr-3 text-sm outline-none focus:ring-2 focus:ring-ring"
            />
          </label>
          <label className="flex items-center gap-2 rounded-md border border-input bg-background px-3 text-sm">
            <MapPin className="h-4 w-4 text-muted-foreground" />
            <select
              value={region}
              onChange={(e) => setRegion(e.target.value)}
              className="w-full bg-transparent py-2 outline-none"
              aria-label="Filtrar por región"
            >
              <option value="todas">Todas las regiones</option>
              {REGIONES_CHILE.map((r) => (
                <option key={r} value={r}>{r}</option>
              ))}
            </select>
          </label>
          <label className="flex items-center gap-2 rounded-md border border-input bg-background px-3 text-sm">
            <Filter className="h-4 w-4 text-muted-foreground" />
            <select
              value={doc}
              onChange={(e) => setDoc(e.target.value)}
              className="w-full bg-transparent py-2 outline-none"
              aria-label="Filtrar por estado de documentos"
            >
              <option value="todos">Todos los estados</option>
              <option value="vigente">Documentos vigentes</option>
              <option value="por_vencer">Por vencer</option>
              <option value="vencido">Vencidos</option>
              <option value="sin_datos">Sin datos</option>
            </select>
          </label>
        </div>
      </section>

      <section className="rounded-lg border border-border bg-card shadow-sm">
        {isLoading ? (
          <div className="flex items-center justify-center gap-2 p-10 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Cargando proveedores…
          </div>
        ) : error ? (
          <div className="p-6 text-sm text-red-600">No se pudo cargar el directorio.</div>
        ) : rows.length === 0 ? (
          <div className="p-10 text-center text-sm text-muted-foreground">
            No se encontraron proveedores con los filtros seleccionados.
          </div>
        ) : (
          <>
            {/* Desktop table */}
            <div className="hidden overflow-x-auto md:block">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 text-left text-xs uppercase text-muted-foreground">
                  <tr>
                    <th className="px-4 py-3">Proveedor</th>
                    <th className="px-4 py-3">Región</th>
                    <th className="px-4 py-3">Flota</th>
                    <th className="px-4 py-3">Choferes</th>
                    <th className="px-4 py-3">Documentos</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => {
                    const k = docKey(r);
                    return (
                      <tr key={r.id} className="border-t border-border">
                        <td className="px-4 py-3">
                          <div className="font-medium text-foreground">{r.razon_social || "—"}</div>
                          <div className="text-xs text-muted-foreground">{r.rut_empresa || ""}</div>
                        </td>
                        <td className="px-4 py-3">{r.region || "—"}</td>
                        <td className="px-4 py-3">{r.trucks_count}</td>
                        <td className="px-4 py-3">{r.drivers_count}</td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${DOC_CLASS[k]}`}>
                            {DOC_LABEL[k]}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Mobile cards */}
            <ul className="divide-y divide-border md:hidden">
              {rows.map((r) => {
                const k = docKey(r);
                return (
                  <li key={r.id} className="p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="font-medium text-foreground">{r.razon_social || "—"}</div>
                        <div className="text-xs text-muted-foreground">{r.rut_empresa || ""}</div>
                      </div>
                      <span className={`shrink-0 rounded-full border px-2 py-0.5 text-xs font-medium ${DOC_CLASS[k]}`}>
                        {DOC_LABEL[k]}
                      </span>
                    </div>
                    <div className="mt-2 flex flex-wrap gap-3 text-xs text-muted-foreground">
                      <span className="inline-flex items-center gap-1"><MapPin className="h-3 w-3" />{r.region || "—"}</span>
                      <span className="inline-flex items-center gap-1"><Truck className="h-3 w-3" />{r.trucks_count} camiones</span>
                      <span className="inline-flex items-center gap-1"><Users className="h-3 w-3" />{r.drivers_count} choferes</span>
                    </div>
                  </li>
                );
              })}
            </ul>
          </>
        )}
      </section>
    </div>
  );
}

function StatCard({ label, value, tone }: { label: string; value: number; tone: "primary" | "ok" | "warn" | "danger" }) {
  const cls =
    tone === "ok" ? "border-emerald-200 bg-emerald-50 text-emerald-800" :
    tone === "warn" ? "border-amber-200 bg-amber-50 text-amber-800" :
    tone === "danger" ? "border-red-200 bg-red-50 text-red-800" :
    "border-primary/20 bg-primary-soft text-primary-dark";
  return (
    <div className={`rounded-lg border p-4 ${cls}`}>
      <div className="text-xs font-medium uppercase opacity-80">{label}</div>
      <div className="mt-1 text-2xl font-bold">{value}</div>
    </div>
  );
}
