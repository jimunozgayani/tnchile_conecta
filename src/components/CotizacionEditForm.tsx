import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Loader2, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { getSignedUrl } from "@/lib/signed-url";
import { validateUpload } from "@/lib/upload-validation";
import { actualizarCotizacionCompleta } from "@/lib/cotizaciones.functions";

const ESTADOS_CON_PRECIO = [
  "cotizada",
  "aceptada",
  "lista_para_operar",
  "confirmada",
  "en_operacion",
  "finalizada",
  "cobro_pendiente",
  "cerrada",
  "rechazada",
];

const PAGOS: { v: string; label: string }[] = [
  { v: "contado", label: "Contado" },
  { v: "50_50", label: "50 / 50" },
  { v: "15_dias", label: "15 días" },
  { v: "30_dias", label: "30 días" },
];

export type FichaEditable = {
  id: string;
  estado: string;
  contacto_id: string | null;
  contacto_nombre: string | null;
  origen: string | null;
  destinos: unknown;
  tipo_camion_id: string | null;
  tipo_camion_otro: string | null;
  peso_kg: number | null;
  largo_cm: number | null;
  ancho_cm: number | null;
  alto_cm: number | null;
  fecha_despacho: string | null;
  notas_admin: string | null;
  precio_ofrecido_cliente_clp: number | null;
  presupuesto_referencial_cliente_clp: number | null;
  tipo_pago: string | null;
  validez_hasta: string | null;
  fotos: unknown;
  carga_hora_desde: string | null;
  carga_hora_hasta: string | null;
  descarga_fecha: string | null;
  descarga_hora_desde: string | null;
  descarga_hora_hasta: string | null;
  descarga_notas: string | null;
};

/** Postgres devuelve time como "HH:MM:SS"; el input[type=time] usa "HH:MM". */
const hhmm = (t: string | null) => (t ? t.slice(0, 5) : "");

const num = (n: number | null) => (n === null || n === undefined ? "" : String(n));

const fotoPathsOf = (fotos: unknown): string[] => {
  if (!Array.isArray(fotos)) return [];
  return fotos
    .map((f) => {
      if (typeof f === "string") return f;
      if (f && typeof f === "object") {
        const o = f as Record<string, unknown>;
        const v = o["path"] ?? o["storage_path"] ?? o["url"];
        if (typeof v === "string") return v;
      }
      return null;
    })
    .filter((v): v is string => !!v);
};

const primerDestino = (destinos: unknown): string => {
  if (Array.isArray(destinos) && destinos.length > 0) {
    const d = destinos[0];
    if (typeof d === "string") return d;
    if (d && typeof d === "object") {
      const o = d as Record<string, unknown>;
      const v = o["nombre"] ?? o["destino"] ?? o["ciudad"] ?? o["texto"];
      if (typeof v === "string") return v;
    }
  }
  return "";
};

const inputCls = "w-full rounded-md border bg-background px-3 py-2 text-sm";
const labelCls = "mb-1 block text-xs font-medium";

/**
 * Edición de la ficha.
 * - admin / líder de cuenta: todos los campos, en cualquier estado.
 * - comercial (`soloCarga`): datos de la carga + presupuesto referencial del cliente.
 */
export function CotizacionEditForm({
  ficha,
  soloCarga = false,
  onCancel,
  onSaved,
}: {
  ficha: FichaEditable;
  soloCarga?: boolean;
  onCancel: () => void;
  onSaved: (patch: Record<string, unknown>) => void;
}) {
  const guardar = useServerFn(actualizarCotizacionCompleta);
  const precioEditable = !soloCarga && ESTADOS_CON_PRECIO.includes(ficha.estado);

  const [contactoQ, setContactoQ] = useState("");
  const [contactoId, setContactoId] = useState(ficha.contacto_id ?? "");
  const [origen, setOrigen] = useState(ficha.origen ?? "");
  const [destino, setDestino] = useState(primerDestino(ficha.destinos));
  const [tipoCamionId, setTipoCamionId] = useState(ficha.tipo_camion_id ?? "");
  const [tipoCamionOtro, setTipoCamionOtro] = useState(ficha.tipo_camion_otro ?? "");
  const [peso, setPeso] = useState(num(ficha.peso_kg));
  const [largo, setLargo] = useState(num(ficha.largo_cm));
  const [ancho, setAncho] = useState(num(ficha.ancho_cm));
  const [alto, setAlto] = useState(num(ficha.alto_cm));
  const [fecha, setFecha] = useState(ficha.fecha_despacho ?? "");
  const [notas, setNotas] = useState(ficha.notas_admin ?? "");
  const [precio, setPrecio] = useState(num(ficha.precio_ofrecido_cliente_clp));
  const [presupuesto, setPresupuesto] = useState(num(ficha.presupuesto_referencial_cliente_clp));
  const [tipoPago, setTipoPago] = useState(ficha.tipo_pago ?? "");
  const [validez, setValidez] = useState(ficha.validez_hasta ?? "");
  const [cargaDesde, setCargaDesde] = useState(hhmm(ficha.carga_hora_desde));
  const [cargaHasta, setCargaHasta] = useState(hhmm(ficha.carga_hora_hasta));
  const [descargaFecha, setDescargaFecha] = useState(ficha.descarga_fecha ?? "");
  const [descargaDesde, setDescargaDesde] = useState(hhmm(ficha.descarga_hora_desde));
  const [descargaHasta, setDescargaHasta] = useState(hhmm(ficha.descarga_hora_hasta));
  const [descargaNotas, setDescargaNotas] = useState(ficha.descarga_notas ?? "");
  const [paths, setPaths] = useState<string[]>(fotoPathsOf(ficha.fotos));
  const [nuevas, setNuevas] = useState<File[]>([]);
  const [saving, setSaving] = useState(false);

  const tiposQuery = useQuery({
    queryKey: ["tipos-camion-activos"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tipos_camion")
        .select("id, nombre")
        .eq("activo", true)
        .order("orden");
      if (error) throw error;
      return (data ?? []) as { id: string; nombre: string }[];
    },
  });

  const contactosQuery = useQuery({
    queryKey: ["contactos-select", contactoQ],
    enabled: !soloCarga,
    queryFn: async () => {
      let q = supabase
        .from("contactos")
        .select("id, nombre, empresa")
        .is("deleted_at", null)
        .order("nombre")
        .limit(50);
      const term = contactoQ.trim();
      if (term) q = q.or(`nombre.ilike.%${term}%,empresa.ilike.%${term}%`);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as { id: string; nombre: string; empresa: string | null }[];
    },
  });

  const previewsQuery = useQuery({
    queryKey: ["cotizacion-fotos-edit", ficha.id, paths.join("|")],
    enabled: paths.length > 0,
    queryFn: async () => {
      const urls = await Promise.all(
        paths.map(async (p) => ({ path: p, url: await getSignedUrl("cotizacion-fotos", p) })),
      );
      return urls.filter((u): u is { path: string; url: string } => !!u.url);
    },
  });

  const addFiles = (files: FileList | null) => {
    if (!files) return;
    const next: File[] = [];
    for (const f of Array.from(files)) {
      const v = validateUpload(f);
      if (!v.ok) {
        toast.error(v.error);
        continue;
      }
      next.push(f);
    }
    if (paths.length + nuevas.length + next.length > 5) {
      toast.error("Máximo 5 fotos por cotización.");
      return;
    }
    setNuevas((prev) => [...prev, ...next]);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const rutas = [...paths];
      if (nuevas.length > 0) {
        const { data: authData } = await supabase.auth.getUser();
        const uid = authData.user?.id;
        if (!uid) throw new Error("Sesión expirada, vuelve a iniciar sesión.");
        for (const file of nuevas) {
          const path = `${uid}/${Date.now()}-${file.name.replace(/[^\w.\-]+/g, "_")}`;
          const { error } = await supabase.storage.from("cotizacion-fotos").upload(path, file);
          if (error) throw new Error(error.message);
          rutas.push(path);
        }
      }

      const payload: Record<string, unknown> = {
        id: ficha.id,
        origen: origen || null,
        destino: destino || null,
        tipo_camion_id: tipoCamionId || null,
        tipo_camion_otro: tipoCamionOtro || null,
        peso_kg: peso === "" ? null : Number(peso),
        largo_cm: largo === "" ? null : Number(largo),
        ancho_cm: ancho === "" ? null : Number(ancho),
        alto_cm: alto === "" ? null : Number(alto),
        fecha_despacho: fecha || null,
        notas_admin: notas || null,
        presupuesto_referencial_cliente_clp: presupuesto === "" ? null : Number(presupuesto),
        fotos: rutas,
        carga_hora_desde: cargaDesde || null,
        carga_hora_hasta: cargaHasta || null,
        descarga_fecha: descargaFecha || null,
        descarga_hora_desde: descargaDesde || null,
        descarga_hora_hasta: descargaHasta || null,
        descarga_notas: descargaNotas || null,
      };
      if (fecha && descargaFecha && descargaFecha < fecha) {
        throw new Error("La fecha de descarga no puede ser anterior a la fecha de despacho.");
      }
      if (!soloCarga && contactoId && contactoId !== ficha.contacto_id)
        payload["contacto_id"] = contactoId;
      if (precioEditable) {
        payload["precio_ofrecido_cliente_clp"] = precio === "" ? null : Number(precio);
        payload["tipo_pago"] = tipoPago || null;
        payload["validez_hasta"] = validez || null;
      }

      await guardar({ data: payload as never });
      toast.success("Cambios guardados");
      onSaved({
        origen: payload["origen"],
        destinos: destino ? [destino] : [],
        fecha_despacho: payload["fecha_despacho"],
        carga_hora_desde: payload["carga_hora_desde"],
        carga_hora_hasta: payload["carga_hora_hasta"],
        descarga_fecha: payload["descarga_fecha"],
        descarga_hora_desde: payload["descarga_hora_desde"],
        descarga_hora_hasta: payload["descarga_hora_hasta"],
        descarga_notas: payload["descarga_notas"],
        presupuesto_referencial_cliente_clp: payload["presupuesto_referencial_cliente_clp"],
        ...(precioEditable ? { precio_ofrecido_cliente_clp: payload["precio_ofrecido_cliente_clp"] } : {}),
      });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudieron guardar los cambios");
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={(e) => void submit(e)} className="space-y-4 md:col-span-2">
      <div className="grid gap-3 sm:grid-cols-2">
        {!soloCarga && (
        <div className="sm:col-span-2">
          <label className={labelCls} htmlFor="edit-contacto-q">
            Contacto {ficha.contacto_nombre ? `(actual: ${ficha.contacto_nombre})` : ""}
          </label>
          <input
            id="edit-contacto-q"
            value={contactoQ}
            onChange={(e) => setContactoQ(e.target.value)}
            placeholder="Buscar contacto por nombre o empresa…"
            className={`${inputCls} mb-2`}
          />
          <select
            aria-label="Seleccionar contacto"
            value={contactoId}
            onChange={(e) => setContactoId(e.target.value)}
            className={inputCls}
          >
            <option value="">— Mantener contacto actual —</option>
            {(contactosQuery.data ?? []).map((c) => (
              <option key={c.id} value={c.id}>
                {c.nombre}
                {c.empresa ? ` — ${c.empresa}` : ""}
              </option>
            ))}
          </select>
        </div>
        )}

        <div>
          <label className={labelCls} htmlFor="edit-origen">Origen</label>
          <input id="edit-origen" value={origen} onChange={(e) => setOrigen(e.target.value)} className={inputCls} />
        </div>
        <div>
          <label className={labelCls} htmlFor="edit-destino">Destino</label>
          <input id="edit-destino" value={destino} onChange={(e) => setDestino(e.target.value)} className={inputCls} />
        </div>

        <div>
          <label className={labelCls} htmlFor="edit-tipo">Tipo de camión</label>
          <select
            id="edit-tipo"
            value={tipoCamionId}
            onChange={(e) => setTipoCamionId(e.target.value)}
            className={inputCls}
          >
            <option value="">Sin definir</option>
            {(tiposQuery.data ?? []).map((t) => (
              <option key={t.id} value={t.id}>
                {t.nombre}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className={labelCls} htmlFor="edit-tipo-otro">Otro tipo (texto libre)</label>
          <input
            id="edit-tipo-otro"
            value={tipoCamionOtro}
            onChange={(e) => setTipoCamionOtro(e.target.value)}
            className={inputCls}
          />
        </div>

        <div>
          <label className={labelCls} htmlFor="edit-peso">Peso (kg)</label>
          <input
            id="edit-peso"
            type="number"
            min={0}
            step={1}
            value={peso}
            onChange={(e) => setPeso(e.target.value)}
            className={inputCls}
          />
        </div>
        <div>
          <label className={labelCls} htmlFor="edit-fecha">Fecha de despacho</label>
          <input
            id="edit-fecha"
            type="date"
            value={fecha}
            onChange={(e) => setFecha(e.target.value)}
            className={inputCls}
          />
        </div>

        <div className="sm:col-span-2">
          <p className={labelCls}>Dimensiones (opcional)</p>
          <div className="grid grid-cols-3 gap-2">
            <input
              aria-label="Largo (cm)"
              placeholder="Largo (cm)"
              type="number"
              min={0}
              step={1}
              value={largo}
              onChange={(e) => setLargo(e.target.value)}
              className={inputCls}
            />
            <input
              aria-label="Ancho (cm)"
              placeholder="Ancho (cm)"
              type="number"
              min={0}
              step={1}
              value={ancho}
              onChange={(e) => setAncho(e.target.value)}
              className={inputCls}
            />
            <input
              aria-label="Alto (cm)"
              placeholder="Alto (cm)"
              type="number"
              min={0}
              step={1}
              value={alto}
              onChange={(e) => setAlto(e.target.value)}
              className={inputCls}
            />
          </div>
        </div>

        {precioEditable && (
          <>
            <div>
              <label className={labelCls} htmlFor="edit-precio">Precio al cliente (CLP)</label>
              <input
                id="edit-precio"
                type="number"
                min={0}
                step={1}
                value={precio}
                onChange={(e) => setPrecio(e.target.value)}
                className={inputCls}
              />
            </div>
            <div>
              <label className={labelCls} htmlFor="edit-pago">Condición de pago</label>
              <select
                id="edit-pago"
                value={tipoPago}
                onChange={(e) => setTipoPago(e.target.value)}
                className={inputCls}
              >
                <option value="">Sin definir</option>
                {PAGOS.map((p) => (
                  <option key={p.v} value={p.v}>
                    {p.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelCls} htmlFor="edit-validez">Validez hasta</label>
              <input
                id="edit-validez"
                type="date"
                value={validez}
                onChange={(e) => setValidez(e.target.value)}
                className={inputCls}
              />
            </div>
          </>
        )}

        <div className="sm:col-span-2">
          <label className={labelCls} htmlFor="edit-presupuesto">
            Presupuesto referencial del cliente (opcional)
          </label>
          <input
            id="edit-presupuesto"
            type="number"
            min={0}
            step={1}
            value={presupuesto}
            onChange={(e) => setPresupuesto(e.target.value)}
            className={inputCls}
          />
          <p className="mt-1 text-[11px] text-muted-foreground">
            Lo que el cliente comentó estar dispuesto a pagar — ayuda a operaciones a negociar y a
            definir el precio final.
          </p>
        </div>

        <div className="sm:col-span-2 rounded-md border bg-muted/30 p-3">
          <p className="mb-2 text-sm font-semibold">Horario de carga</p>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className={labelCls} htmlFor="edit-carga-desde">Hora desde</label>
              <input
                id="edit-carga-desde"
                type="time"
                value={cargaDesde}
                onChange={(e) => setCargaDesde(e.target.value)}
                className={inputCls}
              />
            </div>
            <div>
              <label className={labelCls} htmlFor="edit-carga-hasta">Hora hasta</label>
              <input
                id="edit-carga-hasta"
                type="time"
                value={cargaHasta}
                onChange={(e) => setCargaHasta(e.target.value)}
                className={inputCls}
              />
            </div>
          </div>
          <p className="mt-1 text-[11px] text-muted-foreground">
            La fecha de carga es la fecha de despacho indicada arriba.
          </p>
        </div>

        <div className="sm:col-span-2 rounded-md border bg-muted/30 p-3">
          <p className="mb-2 text-sm font-semibold">Horario de descarga</p>
          <div className="grid gap-2 sm:grid-cols-3">
            <div>
              <label className={labelCls} htmlFor="edit-descarga-fecha">Fecha</label>
              <input
                id="edit-descarga-fecha"
                type="date"
                value={descargaFecha}
                onChange={(e) => setDescargaFecha(e.target.value)}
                className={inputCls}
              />
            </div>
            <div>
              <label className={labelCls} htmlFor="edit-descarga-desde">Hora desde</label>
              <input
                id="edit-descarga-desde"
                type="time"
                value={descargaDesde}
                onChange={(e) => setDescargaDesde(e.target.value)}
                className={inputCls}
              />
            </div>
            <div>
              <label className={labelCls} htmlFor="edit-descarga-hasta">Hora hasta</label>
              <input
                id="edit-descarga-hasta"
                type="time"
                value={descargaHasta}
                onChange={(e) => setDescargaHasta(e.target.value)}
                className={inputCls}
              />
            </div>
          </div>
          <div className="mt-2">
            <label className={labelCls} htmlFor="edit-descarga-notas">Notas de descarga (opcional)</label>
            <textarea
              id="edit-descarga-notas"
              rows={2}
              value={descargaNotas}
              onChange={(e) => setDescargaNotas(e.target.value)}
              placeholder="Ej: destino solo recibe en horario hábil, puede ser el día siguiente"
              className={inputCls}
            />
          </div>
          <p className="mt-1 text-[11px] text-muted-foreground">
            La descarga puede ser el mismo día o días posteriores a la carga.
          </p>
        </div>

        <div className="sm:col-span-2">
          <label className={labelCls} htmlFor="edit-notas">Notas internas</label>
          <textarea
            id="edit-notas"
            rows={4}
            value={notas}
            onChange={(e) => setNotas(e.target.value)}
            className={inputCls}
          />
        </div>

        <div className="sm:col-span-2">
          <p className={labelCls}>Fotos ({paths.length + nuevas.length}/5)</p>
          {paths.length > 0 && (
            <div className="mb-2 grid grid-cols-3 gap-2">
              {(previewsQuery.data ?? []).map((p) => (
                <div key={p.path} className="relative">
                  <img src={p.url} alt="Foto de la carga" className="h-20 w-full rounded border object-cover" />
                  <button
                    type="button"
                    aria-label="Quitar foto"
                    onClick={() => setPaths((prev) => prev.filter((x) => x !== p.path))}
                    className="absolute right-1 top-1 rounded bg-background/90 p-1 text-destructive"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}
          <input
            type="file"
            multiple
            accept="image/jpeg,image/png,.jpg,.jpeg,.png"
            onChange={(e) => addFiles(e.target.files)}
            className="text-xs"
          />
          {nuevas.length > 0 && (
            <ul className="mt-1 space-y-0.5 text-[11px] text-muted-foreground">
              {nuevas.map((f, i) => (
                <li key={`${f.name}-${i}`} className="flex items-center gap-2">
                  <span className="truncate">{f.name}</span>
                  <button
                    type="button"
                    onClick={() => setNuevas((prev) => prev.filter((_, j) => j !== i))}
                    className="text-destructive"
                  >
                    quitar
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {!precioEditable && (
        <p className="text-[11px] text-muted-foreground">
          {soloCarga
            ? "El precio al cliente, la condición de pago y la validez los define administración o el líder de cuenta."
            : "El precio, la condición de pago y la validez se pueden editar desde el estado “Cotizada” en adelante."}
        </p>
      )}

      <div className="flex justify-end gap-2 border-t pt-3">
        <button type="button" onClick={onCancel} className="rounded-md border px-4 py-2 text-sm">
          Cancelar
        </button>
        <button
          type="submit"
          disabled={saving}
          className="inline-flex items-center gap-1.5 rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-60"
        >
          {saving && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
          {saving ? "Guardando…" : "Guardar cambios"}
        </button>
      </div>
    </form>
  );
}
