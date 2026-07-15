import { createFileRoute } from "@tanstack/react-router";
import { pageHead } from "@/lib/page-head";
import { useEffect, useMemo, useState } from "react";
import { Save, MapPin } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import {
  REGIONES_CAPITALES,
  TIPOS_CAMION_TARIFA,
  type TipoCamionTarifa,
  fmtMiles,
  parseMiles,
} from "@/lib/regiones-capitales";

export const Route = createFileRoute("/_app/tarifas")({
  head: () => pageHead("/tarifas", "Tarifas por región · Portal Proveedores TN Chile", "Publica y actualiza tus tarifas de transporte por región y tipo de camión para las 16 capitales regionales de Chile."),
  component: TarifasPage,
});

type Tarifa = {
  id?: string;
  proveedor_id?: string;
  region_origen: string;
  region_destino: string;
  tipo_camion: TipoCamionTarifa;
  precio_base_clp: number | null;
  precio_por_km_clp: number | null;
  incluye_iva: boolean;
  vigente_desde: string;
  notas: string | null;
};

type CellKey = string; // `${destino}|${tipo}`
const cellKey = (destino: string, tipo: string) => `${destino}|${tipo}`;

function TarifasPage() {
  const [userId, setUserId] = useState<string | null>(null);
  const [origen, setOrigen] = useState<string>("Santiago RM");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // cells store the editable base price per (destino, tipo)
  const [cells, setCells] = useState<Record<CellKey, { precio: string; id?: string; iva: boolean; km: string }>>({});

  const destinos = useMemo(
    () => REGIONES_CAPITALES.filter((r) => r.name !== origen),
    [origen]
  );

  const load = async (uid: string, origenSel: string) => {
    setLoading(true);
    const { data, error } = await (supabase as any)
      .from("tarifas")
      .select("*")
      .eq("proveedor_id", uid)
      .eq("region_origen", origenSel);
    if (error) {
      toast.error(error.message);
      setLoading(false);
      return;
    }
    const next: typeof cells = {};
    (data ?? []).forEach((r: Tarifa) => {
      next[cellKey(r.region_destino, r.tipo_camion)] = {
        precio: r.precio_base_clp != null ? fmtMiles(r.precio_base_clp) : "",
        id: r.id,
        iva: !!r.incluye_iva,
        km: r.precio_por_km_clp != null ? fmtMiles(r.precio_por_km_clp) : "",
      };
    });
    setCells(next);
    setLoading(false);
  };

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      setUserId(user.id);
      await load(user.id, origen);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (userId) load(userId, origen);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [origen]);

  const setCell = (destino: string, tipo: string, patch: Partial<{ precio: string; iva: boolean; km: string }>) => {
    const key = cellKey(destino, tipo);
    setCells((prev) => {
      const base = prev[key] ?? { precio: "", iva: false, km: "" };
      return { ...prev, [key]: { ...base, ...patch } };
    });
  };

  const saveAll = async () => {
    if (!userId) return;
    setSaving(true);
    const today = new Date().toISOString().slice(0, 10);
    const toUpsert: any[] = [];
    const toDelete: string[] = [];

    for (const destino of destinos.map((d) => d.name)) {
      for (const t of TIPOS_CAMION_TARIFA) {
        const c = cells[cellKey(destino, t.value)];
        const precio = c ? parseMiles(c.precio) : null;
        const km = c ? parseMiles(c.km) : null;
        if (precio == null && km == null) {
          if (c?.id) toDelete.push(c.id);
          continue;
        }
        toUpsert.push({
          proveedor_id: userId,
          region_origen: origen,
          region_destino: destino,
          tipo_camion: t.value,
          precio_base_clp: precio,
          precio_por_km_clp: km,
          incluye_iva: !!c?.iva,
          vigente_desde: today,
        });
      }
    }

    const { error: upErr } = toUpsert.length
      ? await (supabase as any).from("tarifas").upsert(toUpsert, {
          onConflict: "proveedor_id,region_origen,region_destino,tipo_camion",
        })
      : { error: null };

    const { error: delErr } = toDelete.length
      ? await (supabase as any).from("tarifas").delete().in("id", toDelete)
      : { error: null };

    setSaving(false);
    if (upErr || delErr) {
      toast.error((upErr || delErr)!.message);
    } else {
      toast.success(`Guardadas ${toUpsert.length} tarifas`);
      await load(userId, origen);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold">Tarifas</h1>
          <p className="text-muted-foreground">
            Define precios por región destino y tipo de camión desde tu región de origen.
          </p>
        </div>
        <button
          onClick={saveAll}
          disabled={saving || loading}
          className="flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary-dark disabled:opacity-50"
        >
          <Save className="h-4 w-4" />
          {saving ? "Guardando..." : "Guardar todas las tarifas"}
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-3 rounded-xl border bg-card p-4 shadow-sm">
        <MapPin className="h-4 w-4 text-primary" />
        <label className="text-sm font-medium">Región de origen:</label>
        <select
          value={origen}
          onChange={(e) => setOrigen(e.target.value)}
          className="rounded-md border border-input bg-background px-3 py-2 text-sm"
        >
          {REGIONES_CAPITALES.map((r) => (
            <option key={r.name} value={r.name}>
              {r.name} ({r.code})
            </option>
          ))}
        </select>
        <span className="text-xs text-muted-foreground">
          Las celdas vacías quedan como "No disponible".
        </span>
      </div>

      <div className="overflow-hidden rounded-xl border bg-card shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-primary-soft text-left">
              <tr>
                <th className="sticky left-0 z-10 bg-primary-soft px-4 py-3 font-medium">
                  Destino
                </th>
                {TIPOS_CAMION_TARIFA.map((t) => (
                  <th key={t.value} className="px-4 py-3 font-medium">
                    {t.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y">
              {loading ? (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">
                    Cargando...
                  </td>
                </tr>
              ) : (
                destinos.map((dest) => (
                  <tr key={dest.name} className="hover:bg-muted/30">
                    <td className="sticky left-0 z-10 bg-card px-4 py-3 font-medium whitespace-nowrap">
                      {dest.name}{" "}
                      <span className="text-xs text-muted-foreground">({dest.code})</span>
                    </td>
                    {TIPOS_CAMION_TARIFA.map((t) => {
                      const c = cells[cellKey(dest.name, t.value)];
                      const v = c?.precio ?? "";
                      const empty = !v;
                      return (
                        <td key={t.value} className="px-2 py-2 align-top">
                          <div className="space-y-1">
                            <div className="relative">
                              <span className="pointer-events-none absolute inset-y-0 left-2 flex items-center text-xs text-muted-foreground">
                                $
                              </span>
                              <input
                                value={v}
                                onChange={(e) =>
                                  setCell(dest.name, t.value, {
                                    precio: fmtMiles(parseMiles(e.target.value)),
                                  })
                                }
                                placeholder="No disponible"
                                className={`w-32 rounded-md border border-input bg-background pl-5 pr-2 py-1.5 text-sm font-mono ${
                                  empty ? "text-muted-foreground placeholder:italic" : ""
                                }`}
                              />
                            </div>
                            <div className="flex items-center gap-1">
                              <span className="text-[10px] text-muted-foreground">km</span>
                              <input
                                value={c?.km ?? ""}
                                onChange={(e) =>
                                  setCell(dest.name, t.value, {
                                    km: fmtMiles(parseMiles(e.target.value)),
                                  })
                                }
                                placeholder="—"
                                className="w-20 rounded-md border border-input bg-background px-1.5 py-1 text-xs font-mono"
                              />
                              <label className="ml-1 flex items-center gap-1 text-[10px] text-muted-foreground">
                                <input
                                  type="checkbox"
                                  checked={!!c?.iva}
                                  onChange={(e) =>
                                    setCell(dest.name, t.value, { iva: e.target.checked })
                                  }
                                />
                                IVA
                              </label>
                            </div>
                          </div>
                        </td>
                      );
                    })}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
