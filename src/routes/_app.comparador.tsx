import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Trophy, ArrowLeftRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import {
  REGIONES_CAPITALES,
  TIPOS_CAMION_TARIFA,
  type TipoCamionTarifa,
  fmtCLP,
} from "@/lib/regiones-capitales";

export const Route = createFileRoute("/_app/comparador")({
  component: ComparadorPage,
});

type Row = {
  id: string;
  proveedor_id: string;
  precio_base_clp: number | null;
  precio_por_km_clp: number | null;
  incluye_iva: boolean;
  updated_at: string;
  razon_social?: string | null;
  correo?: string | null;
};

function ComparadorPage() {
  const navigate = useNavigate();
  const [checking, setChecking] = useState(true);
  const [origen, setOrigen] = useState<string>("Santiago RM");
  const [destino, setDestino] = useState<string>("Valparaíso");
  const [tipo, setTipo] = useState<TipoCamionTarifa>("tracto");
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { navigate({ to: "/login" }); return; }
      const { data: roles } = await supabase.from("user_roles").select("role").eq("user_id", user.id);
      const isAdmin = (roles ?? []).some((r: any) => r.role === "admin");
      if (!isAdmin) { navigate({ to: "/dashboard" }); return; }
      setChecking(false);
    })();
  }, [navigate]);

  useEffect(() => {
    if (checking) return;
    (async () => {
      setLoading(true);
      const { data: tarifas } = await (supabase as any)
        .from("tarifas").select("*")
        .eq("region_origen", origen)
        .eq("region_destino", destino)
        .eq("tipo_camion", tipo);
      const list: Row[] = tarifas ?? [];
      const ids = Array.from(new Set(list.map((r) => r.proveedor_id)));
      if (ids.length) {
        const { data: profs } = await supabase
          .from("profiles").select("id,razon_social,correo").in("id", ids);
        const map = new Map<string, any>((profs ?? []).map((p: any) => [p.id, p]));
        list.forEach((r) => {
          const p = map.get(r.proveedor_id);
          r.razon_social = p?.razon_social ?? null;
          r.correo = p?.correo ?? null;
        });
      }
      list.sort((a, b) => (a.precio_base_clp ?? Infinity) - (b.precio_base_clp ?? Infinity));
      setRows(list);
      setLoading(false);
    })();
  }, [checking, origen, destino, tipo]);

  const swap = () => { const o = origen; setOrigen(destino); setDestino(o); };

  if (checking) return <div className="p-8 text-muted-foreground">Verificando acceso…</div>;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Comparador de tarifas</h1>
        <p className="text-muted-foreground">Ranking de proveedores por ruta y tipo de camión.</p>
      </div>

      <div className="grid gap-3 rounded-xl border bg-card p-4 shadow-sm md:grid-cols-4">
        <div>
          <label className="block text-xs font-medium text-muted-foreground">Región origen</label>
          <select value={origen} onChange={(e) => setOrigen(e.target.value)}
            className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
            {REGIONES_CAPITALES.map((r) => <option key={r.name} value={r.name}>{r.name} ({r.code})</option>)}
          </select>
        </div>
        <div className="flex items-end">
          <button onClick={swap} title="Invertir"
            className="flex h-10 w-full items-center justify-center gap-1 rounded-md border bg-background text-sm hover:bg-muted">
            <ArrowLeftRight className="h-4 w-4" /> Invertir
          </button>
        </div>
        <div>
          <label className="block text-xs font-medium text-muted-foreground">Región destino</label>
          <select value={destino} onChange={(e) => setDestino(e.target.value)}
            className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
            {REGIONES_CAPITALES.map((r) => <option key={r.name} value={r.name}>{r.name} ({r.code})</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-muted-foreground">Tipo camión</label>
          <select value={tipo} onChange={(e) => setTipo(e.target.value as TipoCamionTarifa)}
            className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
            {TIPOS_CAMION_TARIFA.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border bg-card shadow-sm">
        <div className="border-b bg-muted/40 px-4 py-2 text-sm">
          {loading ? "Cargando…" : `${rows.length} proveedor${rows.length === 1 ? "" : "es"} con tarifa para esta ruta`}
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-primary-soft text-left">
              <tr>
                {["#", "Proveedor", "Precio base", "Precio/km", "IVA", "Actualizado"].map((h) => (
                  <th key={h} className="px-4 py-3 font-medium">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y">
              {!loading && rows.length === 0 && (
                <tr><td colSpan={6} className="px-4 py-10 text-center text-muted-foreground">
                  Ningún proveedor ha cargado tarifas para esta ruta.
                </td></tr>
              )}
              {rows.map((r, i) => (
                <tr key={r.id} className={i === 0 ? "bg-emerald-50/50" : "hover:bg-muted/30"}>
                  <td className="px-4 py-3 font-mono text-xs">
                    {i === 0 ? <span className="inline-flex items-center gap-1 font-semibold text-emerald-700"><Trophy className="h-3.5 w-3.5" /> 1</span> : i + 1}
                  </td>
                  <td className="px-4 py-3">
                    <div className="font-medium">{r.razon_social ?? "Sin razón social"}</div>
                    <div className="text-xs text-muted-foreground">{r.correo ?? "—"}</div>
                  </td>
                  <td className="px-4 py-3 font-mono">{fmtCLP(r.precio_base_clp)}</td>
                  <td className="px-4 py-3 font-mono">{fmtCLP(r.precio_por_km_clp)}</td>
                  <td className="px-4 py-3">
                    <span className={`rounded-full px-2 py-0.5 text-xs ${r.incluye_iva ? "bg-emerald-100 text-emerald-700" : "bg-muted text-muted-foreground"}`}>
                      {r.incluye_iva ? "Incluido" : "+ IVA"}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">
                    {new Date(r.updated_at).toLocaleDateString("es-CL")}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
