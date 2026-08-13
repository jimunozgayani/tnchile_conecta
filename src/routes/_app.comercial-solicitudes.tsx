import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Inbox, MapPin, Truck, Calendar, Clock, UserCheck, X } from "lucide-react";
import { pageHead } from "@/lib/page-head";
import { supabase } from "@/integrations/supabase/client";
import {
  asignarmeSolicitud,
  convertirEnCotizacion,
  descartarSolicitud,
  listarAsignables,
  nombresAsignados,
  reasignarSolicitud,
} from "@/lib/solicitudes.functions";

async function guard() {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw redirect({ to: "/login" });
  const { data } = await supabase.from("user_roles").select("role").eq("user_id", user.id);
  const roles = (data ?? []).map((r: { role: string }) => r.role);
  // Bandeja restringida a admin y lider_cuenta; comercial va a su perfil.
  if (!["admin", "lider_cuenta"].some((r) => roles.includes(r))) {
    throw redirect({ to: roles.includes("comercial") ? "/comercial" : "/dashboard" });
  }
}

export const Route = createFileRoute("/_app/comercial-solicitudes")({
  head: () =>
    pageHead(
      "/comercial-solicitudes",
      "Solicitudes entrantes · TN Chile Conecta",
      "Bandeja de solicitudes de carga recibidas desde el formulario público para triaje del equipo comercial de TN Chile.",
    ),
  ssr: false,
  beforeLoad: guard,
  component: SolicitudesPage,
});

type Solicitud = {
  id: string;
  estado: string;
  contacto_nombre: string | null;
  contacto_telefono: string | null;
  contacto_email: string | null;
  origen: string | null;
  destinos: unknown;
  tipo_camion: string | null;
  modalidad: string | null;
  peso_kg: number | null;
  fecha_despacho: string | null;
  notas_admin: string | null;
  created_at: string;
  asignado_a: string | null;
};

const SELECT_COLS =
  "id, estado, contacto_nombre, contacto_telefono, contacto_email, origen, destinos, tipo_camion, modalidad, peso_kg, fecha_despacho, notas_admin, created_at, asignado_a";

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
  return "—";
};

const fmtFecha = (s: string | null) => {
  if (!s) return "—";
  const [y, m, d] = s.slice(0, 10).split("-");
  return d && m && y ? `${d}/${m}/${y}` : s;
};

const hace = (iso: string) => {
  const ms = Date.now() - new Date(iso).getTime();
  const h = Math.floor(ms / 3_600_000);
  if (h < 1) return "Recibida hace menos de 1 hora";
  if (h < 24) return `Recibida hace ${h} hora${h === 1 ? "" : "s"}`;
  const d = Math.floor(h / 24);
  return `Recibida hace ${d} día${d === 1 ? "" : "s"}`;
};

export default function SolicitudesPage() {
  const navigate = useNavigate();
  const [extras, setExtras] = useState<Solicitud[]>([]);
  const [reasignarId, setReasignarId] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const asignarme = useServerFn(asignarmeSolicitud);
  const convertir = useServerFn(convertirEnCotizacion);
  const descartar = useServerFn(descartarSolicitud);
  const reasignar = useServerFn(reasignarSolicitud);
  const fetchAsignables = useServerFn(listarAsignables);
  const fetchNombres = useServerFn(nombresAsignados);

  const meQuery = useQuery({
    queryKey: ["solicitudes-me"],
    queryFn: async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return { id: "", roles: [] as string[] };
      const { data } = await supabase.from("user_roles").select("role").eq("user_id", user.id);
      return { id: user.id, roles: (data ?? []).map((r: { role: string }) => r.role) };
    },
  });
  const me = meQuery.data ?? { id: "", roles: [] as string[] };
  const esAdminish = ["admin", "lider_cuenta"].some((r) => me.roles.includes(r));

  const listQuery = useQuery({
    queryKey: ["solicitudes-entrantes", me.id, esAdminish],
    enabled: !!me.id,
    queryFn: async () => {
      let q = supabase
        .from("cotizaciones")
        .select(SELECT_COLS)
        .in("estado", ["nueva", "pendiente"])
        .order("created_at", { ascending: false })
        .limit(200);
      // admin y líder de cuenta ven todas; comercial ve las libres y las propias
      if (!esAdminish) q = q.or(`asignado_a.is.null,asignado_a.eq.${me.id}`);
      const { data, error } = await q;
      if (error) throw new Error(error.message);
      return (data ?? []) as unknown as Solicitud[];
    },
  });

  const rows = useMemo(() => {
    const base = listQuery.data ?? [];
    const ids = new Set(base.map((r) => r.id));
    return [...extras.filter((e) => !ids.has(e.id)), ...base];
  }, [listQuery.data, extras]);

  const asignadoIds = useMemo(
    () => [...new Set(rows.map((r) => r.asignado_a).filter((v): v is string => !!v))],
    [rows],
  );

  const nombresQuery = useQuery({
    queryKey: ["solicitudes-nombres", asignadoIds.join(",")],
    enabled: asignadoIds.length > 0,
    queryFn: () => fetchNombres({ data: { ids: asignadoIds } }),
  });
  const nombres = nombresQuery.data ?? {};

  const asignablesQuery = useQuery({
    queryKey: ["solicitudes-asignables"],
    enabled: esAdminish && !!reasignarId,
    queryFn: () => fetchAsignables({}),
  });

  // Realtime: nuevas solicitudes entran arriba de la lista sin recargar
  useEffect(() => {
    const channel = supabase
      .channel("solicitudes-entrantes")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "cotizaciones", filter: "estado=eq.nueva" },
        (payload) => {
          const row = payload.new as unknown as Solicitud;
          setExtras((prev) => (prev.some((r) => r.id === row.id) ? prev : [row, ...prev]));
          toast.info("Nueva solicitud recibida");
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const sinAsignar = rows.filter((r) => !r.asignado_a).length;

  const run = async (id: string, fn: () => Promise<unknown>, msg: string, goto?: boolean) => {
    setBusy(id);
    try {
      await fn();
      toast.success(msg);
      setExtras((prev) => prev.filter((r) => r.id !== id));
      await listQuery.refetch();
      if (goto) navigate({ to: "/comercial-cotizaciones" });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Error");
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-6">
      <header className="mb-6 flex items-center gap-3">
        <Inbox className="h-6 w-6 text-primary" aria-hidden />
        <h1 className="text-2xl font-bold text-foreground">Solicitudes entrantes</h1>
        <span className="rounded-full bg-primary/10 px-3 py-1 text-sm font-semibold text-primary">
          {sinAsignar} sin asignar
        </span>
      </header>

      {listQuery.isLoading ? (
        <div className="space-y-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-32 animate-pulse rounded-lg border border-border bg-muted/40" />
          ))}
        </div>
      ) : rows.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed border-border py-16 text-center">
          <Inbox className="h-12 w-12 text-muted-foreground" aria-hidden />
          <p className="text-muted-foreground">No hay solicitudes pendientes por ahora.</p>
        </div>
      ) : (
        <ul className="space-y-4">
          {rows.map((r) => (
            <li key={r.id} className="rounded-lg border border-border bg-card p-4 shadow-sm">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="font-bold text-foreground">{r.contacto_nombre ?? "Sin nombre"}</p>
                  <p className="text-sm text-muted-foreground">
                    {[r.contacto_telefono, r.contacto_email].filter(Boolean).join(" · ") || "—"}
                  </p>
                </div>
                <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                  <Clock className="h-3.5 w-3.5" aria-hidden />
                  {hace(r.created_at)}
                </span>
              </div>

              <div className="mt-3 grid gap-2 text-sm text-foreground sm:grid-cols-2">
                <p className="inline-flex items-center gap-2">
                  <MapPin className="h-4 w-4 text-muted-foreground" aria-hidden />
                  {(r.origen ?? "—") + " → " + primerDestino(r.destinos)}
                </p>
                <p className="inline-flex items-center gap-2">
                  <Truck className="h-4 w-4 text-muted-foreground" aria-hidden />
                  {[r.tipo_camion, r.modalidad, r.peso_kg ? `${r.peso_kg} kg` : null]
                    .filter(Boolean)
                    .join(" · ") || "—"}
                </p>
                <p className="inline-flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-muted-foreground" aria-hidden />
                  {fmtFecha(r.fecha_despacho)}
                </p>
                <p className="inline-flex items-center gap-2">
                  <UserCheck className="h-4 w-4 text-muted-foreground" aria-hidden />
                  {r.asignado_a ? (nombres[r.asignado_a] ?? "Asignada") : "Sin asignar"}
                </p>
              </div>

              {r.notas_admin ? (
                <p className="mt-3 rounded bg-muted p-3 text-sm text-muted-foreground">
                  {r.notas_admin}
                </p>
              ) : null}

              <div className="mt-4 flex flex-wrap gap-2">
                {!r.asignado_a ? (
                  <button
                    type="button"
                    disabled={busy === r.id}
                    onClick={() =>
                      run(r.id, () => asignarme({ data: { id: r.id } }), "Solicitud asignada a ti")
                    }
                    className="rounded-md border border-primary px-3 py-2 text-sm font-medium text-primary hover:bg-primary/10 disabled:opacity-50"
                  >
                    Asignarme
                  </button>
                ) : esAdminish ? (
                  <button
                    type="button"
                    onClick={() => setReasignarId(r.id)}
                    className="rounded-md border border-border px-3 py-2 text-sm font-medium text-foreground hover:bg-muted"
                  >
                    Reasignar
                  </button>
                ) : null}

                <button
                  type="button"
                  disabled={busy === r.id}
                  onClick={() =>
                    run(
                      r.id,
                      () => convertir({ data: { id: r.id } }),
                      "Convertida en cotización",
                      true,
                    )
                  }
                  className="rounded-md bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-50"
                >
                  Convertir en cotización
                </button>

                {esAdminish ? (
                  <button
                    type="button"
                    disabled={busy === r.id}
                    onClick={() => {
                      if (!window.confirm("¿Descartar esta solicitud?")) return;
                      void run(r.id, () => descartar({ data: { id: r.id } }), "Solicitud descartada");
                    }}
                    className="rounded-md border border-destructive px-3 py-2 text-sm font-medium text-destructive hover:bg-destructive/10 disabled:opacity-50"
                  >
                    Descartar
                  </button>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      )}

      {reasignarId ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-sm rounded-lg border border-border bg-card p-4 shadow-lg">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-foreground">Reasignar solicitud</h2>
              <button type="button" aria-label="Cerrar" onClick={() => setReasignarId(null)}>
                <X className="h-5 w-5 text-muted-foreground" aria-hidden />
              </button>
            </div>
            {asignablesQuery.isLoading ? (
              <p className="text-sm text-muted-foreground">Cargando equipo…</p>
            ) : (asignablesQuery.data ?? []).length === 0 ? (
              <p className="text-sm text-muted-foreground">No hay usuarios comerciales.</p>
            ) : (
              <ul className="space-y-2">
                {(asignablesQuery.data ?? []).map((u) => (
                  <li key={u.id}>
                    <button
                      type="button"
                      onClick={() => {
                        const id = reasignarId;
                        setReasignarId(null);
                        if (id)
                          void run(
                            id,
                            () => reasignar({ data: { id, user_id: u.id } }),
                            "Solicitud reasignada",
                          );
                      }}
                      className="w-full rounded-md border border-border px-3 py-2 text-left text-sm hover:bg-muted"
                    >
                      <span className="font-medium text-foreground">{u.nombre}</span>
                      <span className="ml-2 text-xs text-muted-foreground">
                        {u.roles.join(", ")}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
