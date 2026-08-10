import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { pageHead } from "@/lib/page-head";
import { requireOperations } from "@/lib/require-admin";
import { getSignedUrl } from "@/lib/signed-url";
import { CountdownBadge } from "@/components/ExploracionCountdown";
import {
  abrirExploracion,
  agregarPropuesta,
  elegirGanadoraYFijarPrecio,
  listarPropuestas,
  type Propuesta,
} from "@/lib/exploracion.functions";
import {
  Loader2,
  MapPin,
  Calendar,
  Truck,
  Search,
  Plus,
  Trophy,
  X,
  AlertCircle,
  ChevronDown,
  ChevronUp,
} from "lucide-react";

export const Route = createFileRoute("/_app/operaciones-exploracion")({
  head: () =>
    pageHead(
      "/operaciones-exploracion",
      "Exploración de proveedores · TN Chile Conecta",
      "Abre la exploración de proveedores para cargas nuevas, registra propuestas de costo y fija la propuesta ganadora desde operaciones TN Chile.",
    ),
  // La sesión de Supabase vive en localStorage: el gate debe correr solo en el cliente.
  ssr: false,
  beforeLoad: requireOperations,
  component: ExploracionPage,
});

type Carga = {
  id: string;
  contacto_nombre: string | null;
  origen: string;
  destinos: unknown;
  tipo_camion: string | null;
  fecha_despacho: string | null;
  estado: string;
  peso_kg: number | null;
  largo_cm: number | null;
  ancho_cm: number | null;
  alto_cm: number | null;
  notas_admin: string | null;
  fotos: unknown;
  exploracion_abierta_at: string | null;
  exploracion_limite_at: string | null;
};
type TipoCamion = { id: string; nombre: string };
type Contacto = { id: string; nombre: string; empresa: string | null };

const clp = (n: number | null | undefined) =>
  n == null ? "—" : `$${Math.round(n).toLocaleString("es-CL")} CLP`;

function primerDestino(destinos: unknown): string {
  if (Array.isArray(destinos) && destinos.length > 0) {
    const d = destinos[0];
    if (typeof d === "string") return d;
    if (d && typeof d === "object") {
      const o = d as Record<string, unknown>;
      const v = o["destino"] ?? o["ciudad"] ?? o["nombre"] ?? o["texto"];
      if (typeof v === "string") return v;
    }
  }
  return "Sin destino";
}

function todosDestinos(destinos: unknown): string[] {
  if (!Array.isArray(destinos)) return [];
  return destinos
    .map((d) => {
      if (typeof d === "string") return d;
      if (d && typeof d === "object") {
        const o = d as Record<string, unknown>;
        const v = o["destino"] ?? o["ciudad"] ?? o["nombre"] ?? o["texto"];
        if (typeof v === "string") return v;
      }
      return null;
    })
    .filter((v): v is string => !!v);
}

const fotoPaths = (fotos: unknown): string[] => {
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

const ESTADO_PROPUESTA: Record<string, { label: string; cls: string }> = {
  propuesta: { label: "Propuesta", cls: "bg-muted text-muted-foreground" },
  ganadora: { label: "Ganadora", cls: "bg-primary/15 text-primary" },
  descartada: { label: "Descartada", cls: "bg-destructive/10 text-destructive" },
};

function DetalleCarga({ c }: { c: Carga }) {
  const paths = useMemo(() => fotoPaths(c.fotos), [c.fotos]);
  const [urls, setUrls] = useState<string[]>([]);
  const [zoom, setZoom] = useState<string | null>(null);

  useEffect(() => {
    let cancel = false;
    if (paths.length === 0) {
      setUrls([]);
      return;
    }
    void (async () => {
      const res = await Promise.all(paths.map((p) => getSignedUrl("cotizacion-fotos", p)));
      if (!cancel) setUrls(res.filter((u): u is string => !!u));
    })();
    return () => {
      cancel = true;
    };
  }, [paths]);

  const dims = [c.largo_cm, c.ancho_cm, c.alto_cm];
  const tieneDims = dims.some((d) => d != null);
  const destinos = todosDestinos(c.destinos);

  return (
    <div className="mt-3 space-y-3 rounded-md bg-muted/40 p-3 text-sm">
      <div className="grid gap-2 sm:grid-cols-2">
        <p>
          <span className="text-xs uppercase tracking-wide text-muted-foreground">Origen</span>
          <br />
          {c.origen || "—"}
        </p>
        <p>
          <span className="text-xs uppercase tracking-wide text-muted-foreground">Destino(s)</span>
          <br />
          {destinos.length > 0 ? destinos.join(" · ") : "—"}
        </p>
        <p>
          <span className="text-xs uppercase tracking-wide text-muted-foreground">Peso</span>
          <br />
          {c.peso_kg != null ? `${Number(c.peso_kg).toLocaleString("es-CL")} kg` : "—"}
        </p>
        {tieneDims && (
          <p>
            <span className="text-xs uppercase tracking-wide text-muted-foreground">
              Dimensiones (cm)
            </span>
            <br />
            {dims.map((d) => (d == null ? "?" : d)).join(" × ")}
          </p>
        )}
      </div>

      {c.notas_admin && (
        <div>
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Notas internas</p>
          <p className="whitespace-pre-wrap">{c.notas_admin}</p>
        </div>
      )}

      {paths.length > 0 && (
        <div>
          <p className="mb-1 text-xs uppercase tracking-wide text-muted-foreground">
            Fotos ({paths.length})
          </p>
          <div className="flex flex-wrap gap-2">
            {urls.map((u) => (
              <button
                key={u}
                type="button"
                onClick={() => setZoom(u)}
                className="overflow-hidden rounded-md border"
              >
                <img src={u} alt="Foto de la carga" className="h-20 w-20 object-cover" />
              </button>
            ))}
          </div>
        </div>
      )}

      {zoom && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
          onClick={() => setZoom(null)}
        >
          <img src={zoom} alt="Foto de la carga" className="max-h-full max-w-full rounded-md" />
        </div>
      )}
    </div>
  );
}

function ExploracionPage() {
  const [cargas, setCargas] = useState<Carga[]>([]);
  const [propuestas, setPropuestas] = useState<Propuesta[]>([]);
  const [tipos, setTipos] = useState<TipoCamion[]>([]);
  const [contactos, setContactos] = useState<Contacto[]>([]);
  const [roles, setRoles] = useState<string[]>([]);
  const [uid, setUid] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [modalCarga, setModalCarga] = useState<Carga | null>(null);
  const [detalle, setDetalle] = useState<Record<string, boolean>>({});
  const [abrirPara, setAbrirPara] = useState<Carga | null>(null);
  const [ganadoraPara, setGanadoraPara] = useState<Propuesta | null>(null);

  const fetchPropuestas = useServerFn(listarPropuestas);
  const abrir = useServerFn(abrirExploracion);
  const agregar = useServerFn(agregarPropuesta);
  const elegir = useServerFn(elegirGanadoraYFijarPrecio);

  const puedeAbrir = roles.includes("admin") || roles.includes("jefe_operaciones");
  const puedeElegir = roles.includes("admin") || roles.includes("lider_cuenta");

  const cargar = useCallback(async () => {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    setUid(user?.id ?? null);

    const [rolRes, cotRes, tipoRes, contRes] = await Promise.all([
      user
        ? supabase.from("user_roles").select("role").eq("user_id", user.id)
        : Promise.resolve({ data: [] as { role: string }[] }),
      supabase
        .from("cotizaciones")
        .select(
          "id, contacto_nombre, origen, destinos, tipo_camion, fecha_despacho, estado, peso_kg, largo_cm, ancho_cm, alto_cm, notas_admin, fotos, exploracion_abierta_at, exploracion_limite_at",
        )
        .in("estado", ["nueva", "en_exploracion"])
        .order("created_at", { ascending: false }),
      supabase.from("tipos_camion").select("id, nombre").eq("activo", true).order("orden"),
      supabase.from("contactos").select("id, nombre, empresa").is("deleted_at", null).order("nombre"),
    ]);

    setRoles(((rolRes.data ?? []) as { role: string }[]).map((r) => r.role));
    const lista = (cotRes.data ?? []) as Carga[];
    setCargas(lista);
    setTipos((tipoRes.data ?? []) as TipoCamion[]);
    setContactos((contRes.data ?? []) as Contacto[]);

    const ids = lista.filter((c) => c.estado === "en_exploracion").map((c) => c.id);
    try {
      setPropuestas(await fetchPropuestas({ data: { cotizacion_ids: ids } }));
    } catch {
      setPropuestas([]);
    }
    setLoading(false);
  }, [fetchPropuestas]);

  useEffect(() => {
    void cargar();
  }, [cargar]);

  // Aviso en tiempo real al operador cuya propuesta fue elegida.
  useEffect(() => {
    if (!uid) return;
    const channel = supabase
      .channel("propuestas-ganadoras")
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "propuestas_proveedor" },
        (payload) => {
          const row = payload.new as { operador_id?: string; estado?: string; cotizacion_id?: string };
          if (row.estado !== "ganadora" || row.operador_id !== uid) return;
          const carga = cargas.find((c) => c.id === row.cotizacion_id);
          toast.success(
            `Tu propuesta para ${carga?.contacto_nombre ?? "esta carga"} fue seleccionada.`,
          );
          void cargar();
        },
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [uid, cargas, cargar]);

  const porCarga = useMemo(() => {
    const m = new Map<string, Propuesta[]>();
    for (const p of propuestas) {
      const arr = m.get(p.cotizacion_id) ?? [];
      arr.push(p);
      m.set(p.cotizacion_id, arr);
    }
    return m;
  }, [propuestas]);

  async function onAbrir(c: Carga, horas: number) {
    setBusy(c.id);
    try {
      await abrir({ data: { cotizacion_id: c.id, duracion_horas: horas } });
      toast.success(`Exploración abierta por ${horas} h.`);
      setAbrirPara(null);
      await cargar();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo abrir la exploración.");
    } finally {
      setBusy(null);
    }
  }

  async function onElegir(
    p: Propuesta,
    precio: number,
    tipoPago: string | null,
    validez: string | null,
  ) {
    setBusy(p.id);
    try {
      await elegir({
        data: {
          propuesta_id: p.id,
          precio_ofrecido_cliente_clp: precio,
          tipo_pago: (tipoPago || null) as never,
          validez_hasta: validez || null,
        },
      });
      const carga = cargas.find((c) => c.id === p.cotizacion_id);
      toast.success(
        `Cotización lista para ${carga?.contacto_nombre ?? "el cliente"} por ${clp(precio)}.`,
      );
      setGanadoraPara(null);
      await cargar();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo elegir la propuesta.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-6">
      <header className="mb-6">
        <h1 className="text-2xl font-bold">Exploración de proveedores</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Cargas esperando exploración y propuestas de costo de proveedores.
        </p>
      </header>

      {loading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Cargando cargas…
        </div>
      ) : cargas.length === 0 ? (
        <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
          No hay cargas nuevas ni en exploración.
        </div>
      ) : (
        <ul className="space-y-4">
          {cargas.map((c) => {
            const props = porCarga.get(c.id) ?? [];
            const abierto = !!detalle[c.id];
            return (
              <li key={c.id} className="rounded-lg border bg-card p-4 shadow-sm">
                {c.estado === "en_exploracion" && c.exploracion_limite_at && (
                  <div className="mb-2">
                    <CountdownBadge
                      limiteAt={c.exploracion_limite_at}
                      abiertaAt={c.exploracion_abierta_at}
                    />
                  </div>
                )}
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold">{c.contacto_nombre ?? "Sin contacto"}</p>
                    <p className="mt-1 flex items-center gap-1 text-sm text-muted-foreground">
                      <MapPin className="h-3.5 w-3.5" />
                      {c.origen} → {primerDestino(c.destinos)}
                    </p>
                    <div className="mt-1 flex flex-wrap gap-3 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Truck className="h-3.5 w-3.5" />
                        {c.tipo_camion ?? "Tipo por definir"}
                      </span>
                      <span className="flex items-center gap-1">
                        <Calendar className="h-3.5 w-3.5" />
                        {c.fecha_despacho ?? "Fecha por confirmar"}
                      </span>
                    </div>
                  </div>
                  <span
                    className={`rounded-full px-2.5 py-1 text-xs font-medium ${
                      c.estado === "en_exploracion"
                        ? "bg-primary/15 text-primary"
                        : "bg-muted text-muted-foreground"
                    }`}
                  >
                    {c.estado === "en_exploracion" ? "En exploración" : "Nueva"}
                  </span>
                </div>

                <button
                  type="button"
                  onClick={() => setDetalle((d) => ({ ...d, [c.id]: !abierto }))}
                  className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
                >
                  {abierto ? (
                    <ChevronUp className="h-3.5 w-3.5" />
                  ) : (
                    <ChevronDown className="h-3.5 w-3.5" />
                  )}
                  {abierto ? "Ocultar detalle" : "Ver detalle completo"}
                </button>

                {abierto && <DetalleCarga c={c} />}

                {c.estado === "nueva" && puedeAbrir && (
                  <div className="mt-4">
                    {abrirPara?.id === c.id ? (
                      <AbrirExploracionSelector
                        busy={busy === c.id}
                        onCancel={() => setAbrirPara(null)}
                        onConfirm={(h) => void onAbrir(c, h)}
                      />
                    ) : (
                      <button
                        onClick={() => setAbrirPara(c)}
                        className="inline-flex items-center gap-2 rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:opacity-90"
                      >
                        <Search className="h-4 w-4" />
                        Abrir exploración
                      </button>
                    )}
                  </div>
                )}

                {c.estado === "nueva" && !puedeAbrir && (
                  <p className="mt-4 flex items-center gap-1.5 text-xs text-muted-foreground">
                    <AlertCircle className="h-3.5 w-3.5" />
                    Esperando que administración abra la exploración.
                  </p>
                )}

                {c.estado === "en_exploracion" && (
                  <div className="mt-4 border-t pt-3">
                    <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      Propuestas ({props.length})
                    </p>
                    {props.length === 0 ? (
                      <p className="text-sm text-muted-foreground">Aún no hay propuestas.</p>
                    ) : (
                      <ul className="space-y-2">
                        {props.map((p) => {
                          const badge =
                            ESTADO_PROPUESTA[p.estado] ?? {
                              label: String(p.estado),
                              cls: "bg-muted text-muted-foreground",
                            };
                          return (
                            <li
                              key={p.id}
                              className="flex flex-wrap items-center justify-between gap-2 rounded-md bg-muted/40 px-3 py-2"
                            >
                              <div className="min-w-0">
                                <p className="truncate text-sm font-medium">
                                  {p.proveedor_nombre} · {clp(p.costo_clp)}
                                </p>
                                <p className="text-xs text-muted-foreground">
                                  Propuesta por {p.operador_nombre}
                                  {p.notas ? ` · ${p.notas}` : ""}
                                </p>
                              </div>
                              <div className="flex items-center gap-2">
                                <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${badge.cls}`}>
                                  {badge.label}
                                </span>
                                {puedeElegir && p.estado === "propuesta" && (
                                  <button
                                    onClick={() => setGanadoraPara(p)}
                                    disabled={busy === p.id}
                                    className="inline-flex items-center gap-1 rounded-md border border-primary px-2 py-1 text-xs font-medium text-primary hover:bg-primary/10 disabled:opacity-60"
                                  >
                                    {busy === p.id ? (
                                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                    ) : (
                                      <Trophy className="h-3.5 w-3.5" />
                                    )}
                                    Elegir ganadora
                                  </button>
                                )}
                              </div>
                            </li>
                          );
                        })}
                      </ul>
                    )}

                    <button
                      onClick={() => setModalCarga(c)}
                      className="mt-3 inline-flex items-center gap-1.5 rounded-md border px-3 py-2 text-sm font-medium hover:bg-accent"
                    >
                      <Plus className="h-4 w-4" /> Agregar propuesta
                    </button>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {modalCarga && (
        <PropuestaModal
          carga={modalCarga}
          tipos={tipos}
          contactos={contactos}
          onClose={() => setModalCarga(null)}
          onSave={async (payload) => {
            await agregar({ data: { cotizacion_id: modalCarga.id, ...payload } });
            toast.success("Propuesta registrada.");
            setModalCarga(null);
            await cargar();
          }}
        />
      )}

      {ganadoraPara && (
        <GanadoraModal
          propuesta={ganadoraPara}
          busy={busy === ganadoraPara.id}
          onClose={() => setGanadoraPara(null)}
          onConfirm={(precio, tipoPago, validez) =>
            void onElegir(ganadoraPara, precio, tipoPago, validez)
          }
        />
      )}
    </div>
  );
}

const DURACIONES = [1, 3, 5, 12, 24];

function AbrirExploracionSelector({
  busy,
  onCancel,
  onConfirm,
}: {
  busy: boolean;
  onCancel: () => void;
  onConfirm: (horas: number) => void;
}) {
  const [horas, setHoras] = useState(3);
  return (
    <div className="rounded-md border bg-muted/30 p-3">
      <p className="text-xs font-medium text-muted-foreground">
        Tiempo límite para recibir propuestas:
      </p>
      <div className="mt-2 flex flex-wrap gap-2">
        {DURACIONES.map((h) => (
          <button
            key={h}
            type="button"
            onClick={() => setHoras(h)}
            className={`rounded-full px-3 py-1 text-xs font-medium ${
              horas === h
                ? "bg-primary text-primary-foreground"
                : "border bg-background hover:bg-accent"
            }`}
          >
            {h} {h === 1 ? "hora" : "horas"}
          </button>
        ))}
      </div>
      <div className="mt-3 flex gap-2">
        <button
          type="button"
          disabled={busy}
          onClick={() => onConfirm(horas)}
          className="inline-flex items-center gap-2 rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground disabled:opacity-60"
        >
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
          Confirmar apertura
        </button>
        <button type="button" onClick={onCancel} className="rounded-md border px-3 py-2 text-sm">
          Cancelar
        </button>
      </div>
    </div>
  );
}

const TIPOS_PAGO = [
  { value: "contado", label: "Contado" },
  { value: "anticipo", label: "Anticipo" },
  { value: "15_dias", label: "15 días" },
  { value: "30_dias", label: "30 días" },
];

function GanadoraModal({
  propuesta,
  busy,
  onClose,
  onConfirm,
}: {
  propuesta: Propuesta;
  busy: boolean;
  onClose: () => void;
  onConfirm: (precio: number, tipoPago: string | null, validez: string | null) => void;
}) {
  const [precio, setPrecio] = useState("");
  const [tipoPago, setTipoPago] = useState("");
  const [validez, setValidez] = useState("");
  const [error, setError] = useState<string | null>(null);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const monto = Number(precio);
    if (!Number.isFinite(monto) || monto <= 0) {
      setError("Ingresa un precio válido para el cliente.");
      return;
    }
    setError(null);
    onConfirm(monto, tipoPago || null, validez || null);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-0 sm:items-center sm:p-4">
      <form
        onSubmit={submit}
        className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-t-xl bg-card p-5 shadow-xl sm:rounded-xl"
      >
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold">Confirmar ganadora y cotizar</h2>
            <p className="text-xs text-muted-foreground">
              {propuesta.proveedor_nombre} · {clp(propuesta.costo_clp)}
            </p>
          </div>
          <button type="button" onClick={onClose} aria-label="Cerrar" className="rounded-md p-1 hover:bg-accent">
            <X className="h-4 w-4" />
          </button>
        </div>

        <label className="block text-sm font-medium">
          Precio a cobrar al cliente (CLP) *
          <input
            type="number"
            min={1}
            step={1000}
            value={precio}
            onChange={(e) => setPrecio(e.target.value)}
            className="mt-1 w-full rounded-md border bg-background px-3 py-2 text-sm"
          />
        </label>
        <p className="mt-1 text-xs text-muted-foreground">
          Costo proveedor: {clp(propuesta.costo_clp)} · Sugerencia con margen 20%:{" "}
          {clp(propuesta.costo_clp * 1.2)}
        </p>

        <label className="mt-3 block text-sm font-medium">
          Condición de pago
          <select
            value={tipoPago}
            onChange={(e) => setTipoPago(e.target.value)}
            className="mt-1 w-full rounded-md border bg-background px-3 py-2 text-sm"
          >
            <option value="">Sin especificar</option>
            {TIPOS_PAGO.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
        </label>

        <label className="mt-3 block text-sm font-medium">
          Válida hasta
          <input
            type="date"
            value={validez}
            onChange={(e) => setValidez(e.target.value)}
            className="mt-1 w-full rounded-md border bg-background px-3 py-2 text-sm"
          />
        </label>

        {error && <p className="mt-3 text-sm text-destructive">{error}</p>}

        <div className="mt-5 flex justify-end gap-2">
          <button type="button" onClick={onClose} className="rounded-md border px-3 py-2 text-sm">
            Cancelar
          </button>
          <button
            type="submit"
            disabled={busy}
            className="inline-flex items-center gap-2 rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground disabled:opacity-60"
          >
            {busy && <Loader2 className="h-4 w-4 animate-spin" />}
            Confirmar ganadora y cotizar
          </button>
        </div>
      </form>
    </div>
  );
}

type PropuestaForm = {
  proveedor_nombre: string;
  proveedor_contacto_id: string | null;
  costo_clp: number;
  tipo_camion_id: string | null;
  notas: string | null;
};

function PropuestaModal({
  carga,
  tipos,
  contactos,
  onClose,
  onSave,
}: {
  carga: Carga;
  tipos: TipoCamion[];
  contactos: Contacto[];
  onClose: () => void;
  onSave: (p: PropuestaForm) => Promise<void>;
}) {
  const [nombre, setNombre] = useState("");
  const [contactoId, setContactoId] = useState("");
  const [buscar, setBuscar] = useState("");
  const [costo, setCosto] = useState("");
  const [tipoId, setTipoId] = useState("");
  const [notas, setNotas] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const filtrados = useMemo(() => {
    const q = buscar.trim().toLowerCase();
    const base = q
      ? contactos.filter(
          (c) =>
            c.nombre.toLowerCase().includes(q) || (c.empresa ?? "").toLowerCase().includes(q),
        )
      : contactos;
    return base.slice(0, 50);
  }, [buscar, contactos]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const monto = Number(costo);
    if (!nombre.trim()) return setError("Ingresa el nombre del proveedor.");
    if (!Number.isFinite(monto) || monto <= 0) return setError("Ingresa un costo válido.");
    setSaving(true);
    try {
      await onSave({
        proveedor_nombre: nombre.trim(),
        proveedor_contacto_id: contactoId || null,
        costo_clp: monto,
        tipo_camion_id: tipoId || null,
        notas: notas.trim() || null,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo guardar la propuesta.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-0 sm:items-center sm:p-4">
      <form
        onSubmit={submit}
        className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-t-xl bg-card p-5 shadow-xl sm:rounded-xl"
      >
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold">Nueva propuesta</h2>
            <p className="text-xs text-muted-foreground">
              {carga.contacto_nombre ?? "Sin contacto"} · {carga.origen} →{" "}
              {primerDestino(carga.destinos)}
            </p>
          </div>
          <button type="button" onClick={onClose} aria-label="Cerrar" className="rounded-md p-1 hover:bg-accent">
            <X className="h-4 w-4" />
          </button>
        </div>

        <label className="block text-sm font-medium">
          Proveedor *
          <input
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            placeholder="Nombre libre del proveedor"
            className="mt-1 w-full rounded-md border bg-background px-3 py-2 text-sm"
          />
        </label>

        <div className="mt-3">
          <p className="text-sm font-medium">Contacto registrado (opcional)</p>
          <input
            value={buscar}
            onChange={(e) => setBuscar(e.target.value)}
            placeholder="Buscar contacto…"
            className="mt-1 w-full rounded-md border bg-background px-3 py-2 text-sm"
          />
          <select
            value={contactoId}
            onChange={(e) => {
              setContactoId(e.target.value);
              const c = contactos.find((x) => x.id === e.target.value);
              if (c && !nombre.trim()) setNombre(c.empresa || c.nombre);
            }}
            className="mt-2 w-full rounded-md border bg-background px-3 py-2 text-sm"
          >
            <option value="">Sin vincular</option>
            {filtrados.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nombre}
                {c.empresa ? ` · ${c.empresa}` : ""}
              </option>
            ))}
          </select>
        </div>

        <label className="mt-3 block text-sm font-medium">
          Costo CLP *
          <input
            type="number"
            min={1}
            step={1000}
            value={costo}
            onChange={(e) => setCosto(e.target.value)}
            className="mt-1 w-full rounded-md border bg-background px-3 py-2 text-sm"
          />
        </label>

        <label className="mt-3 block text-sm font-medium">
          Tipo de camión
          <select
            value={tipoId}
            onChange={(e) => setTipoId(e.target.value)}
            className="mt-1 w-full rounded-md border bg-background px-3 py-2 text-sm"
          >
            <option value="">Sin especificar</option>
            {tipos.map((t) => (
              <option key={t.id} value={t.id}>
                {t.nombre}
              </option>
            ))}
          </select>
        </label>

        <label className="mt-3 block text-sm font-medium">
          Notas
          <textarea
            value={notas}
            onChange={(e) => setNotas(e.target.value)}
            rows={3}
            className="mt-1 w-full rounded-md border bg-background px-3 py-2 text-sm"
          />
        </label>

        {error && <p className="mt-3 text-sm text-destructive">{error}</p>}

        <div className="mt-5 flex justify-end gap-2">
          <button type="button" onClick={onClose} className="rounded-md border px-3 py-2 text-sm">
            Cancelar
          </button>
          <button
            type="submit"
            disabled={saving}
            className="inline-flex items-center gap-2 rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground disabled:opacity-60"
          >
            {saving && <Loader2 className="h-4 w-4 animate-spin" />}
            Guardar propuesta
          </button>
        </div>
      </form>
    </div>
  );
}
