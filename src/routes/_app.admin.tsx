import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Truck, Users, FileText, AlertTriangle, ShieldAlert, Mail, Send, Activity } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { diasHasta, estadoVencimiento } from "@/lib/regions";
import { inviteSupplier, resendInvitation, setSupplierSuspension } from "@/lib/invitations.functions";
import { calcCompleteness, completionTone } from "@/lib/completeness";

type AuditEntry = {
  id: string; tabla_nombre: string; registro_id: string | null;
  accion: "INSERT" | "UPDATE" | "DELETE";
  datos_anteriores: any; datos_nuevos: any;
  usuario_email: string | null; created_at: string;
};

const TABLE_LABEL: Record<string, string> = {
  trucks: "Camión", drivers: "Chofer", documents: "Documento",
  rates: "Tarifa", profiles: "Proveedor",
};

function recordName(e: AuditEntry): string {
  const row = e.datos_nuevos ?? e.datos_anteriores ?? {};
  return row.patente || row.nombre_completo || row.nombre || row.razon_social ||
    (row.origen && row.destino ? `${row.origen} → ${row.destino}` : null) ||
    (e.registro_id ? e.registro_id.slice(0, 8) : "—");
}

function timeAgo(iso: string): string {
  const s = Math.max(1, Math.floor((Date.now() - new Date(iso).getTime()) / 1000));
  if (s < 60) return `hace ${s}s`;
  const m = Math.floor(s / 60); if (m < 60) return `hace ${m}m`;
  const h = Math.floor(m / 60); if (h < 24) return `hace ${h}h`;
  return `hace ${Math.floor(h / 24)}d`;
}

export const Route = createFileRoute("/_app/admin")({
  component: AdminPage,
});

type Invitation = {
  id: string; email: string; company_name: string | null; rut: string | null;
  status: "invited" | "active" | "suspended"; invited_at: string; activated_at: string | null;
  user_id: string | null; notes: string | null;
};
type SupplierStatus = "invitado" | "nuevo" | "activo" | "suspendido";



type Profile = {
  id: string; razon_social: string | null; nombre_contacto: string | null;
  correo: string | null; region: string | null; rut_empresa: string | null;
  telefono: string | null; direccion: string | null; cargo: string | null;
  poliza_seguro_vencimiento: string | null;
};
type Truck = { id: string; user_id: string; tipo: string | null; patente: string; soap_vencimiento: string | null; permiso_circulacion_vencimiento: string | null; revision_tecnica_vencimiento: string | null; deleted_at: string | null };
type Driver = { id: string; user_id: string; nombre_completo: string; licencia_vencimiento: string | null; carnet_vencimiento: string | null; deleted_at: string | null };

const PROFILE_FIELDS: (keyof Profile)[] = [
  "razon_social", "rut_empresa", "nombre_contacto", "cargo",
  "correo", "telefono", "direccion", "region", "poliza_seguro_vencimiento",
];

function AdminPage() {
  const navigate = useNavigate();
  const invite = useServerFn(inviteSupplier);
  const resend = useServerFn(resendInvitation);
  const toggleSuspend = useServerFn(setSupplierSuspension);
  const [checking, setChecking] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [trucks, setTrucks] = useState<Truck[]>([]);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [loading, setLoading] = useState(true);

  const [invEmail, setInvEmail] = useState("");
  const [invCompany, setInvCompany] = useState("");
  const [invRut, setInvRut] = useState("");
  const [invNotes, setInvNotes] = useState("");
  const [sending, setSending] = useState(false);

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { navigate({ to: "/login" }); return; }
      const { data: roles } = await supabase.from("user_roles").select("role").eq("user_id", user.id);
      const admin = (roles ?? []).some((r: any) => r.role === "admin");
      setIsAdmin(admin);
      setChecking(false);
      // loadAll is triggered by the showDeleted/isAdmin effect once isAdmin flips true
    })();
  }, [navigate]);


  const [showDeleted, setShowDeleted] = useState(false);
  const [audit, setAudit] = useState<AuditEntry[]>([]);

  const loadAll = async () => {
    const profilesQ = supabase.from("profiles").select("*");
    const trucksQ = supabase.from("trucks").select("id,user_id,tipo,patente,soap_vencimiento,permiso_circulacion_vencimiento,revision_tecnica_vencimiento,deleted_at");
    const driversQ = supabase.from("drivers").select("id,user_id,nombre_completo,licencia_vencimiento,carnet_vencimiento,deleted_at");
    if (!showDeleted) {
      profilesQ.is("deleted_at", null);
      trucksQ.is("deleted_at", null);
      driversQ.is("deleted_at", null);
    }
    const [{ data: p }, { data: t }, { data: d }, { data: inv }, { data: a }] = await Promise.all([
      profilesQ,
      trucksQ,
      driversQ,
      supabase.from("supplier_invitations").select("*").order("invited_at", { ascending: false }),
      supabase.from("audit_log").select("*").order("created_at", { ascending: false }).limit(20),
    ]);
    setProfiles((p ?? []) as Profile[]);
    setTrucks((t ?? []) as Truck[]);
    setDrivers((d ?? []) as Driver[]);
    setInvitations((inv ?? []) as Invitation[]);
    setAudit((a ?? []) as AuditEntry[]);
    setLoading(false);
  };

  useEffect(() => { if (isAdmin) loadAll(); }, [showDeleted, isAdmin]);

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!invEmail.trim()) return;
    setSending(true);
    try {
      await invite({ data: { email: invEmail.trim(), company_name: invCompany || null, rut: invRut || null, notes: invNotes || null } });
      toast.success(`Invitación enviada a ${invEmail}`);
      setInvEmail(""); setInvCompany(""); setInvRut(""); setInvNotes("");
      loadAll();
    } catch (err: any) {
      toast.error(err?.message ?? "No se pudo enviar la invitación");
    } finally {
      setSending(false);
    }
  };

  const handleResend = async (id: string, email: string) => {
    try {
      await resend({ data: { id } });
      toast.success(`Invitación reenviada a ${email}`);
      loadAll();
    } catch (err: any) {
      toast.error(err?.message ?? "No se pudo reenviar");
    }
  };

  const handleToggleSuspension = async (email: string, suspended: boolean) => {
    const verb = suspended ? "suspender" : "reactivar";
    if (!window.confirm(`¿Confirmas ${verb} la cuenta de ${email}?`)) return;
    try {
      await toggleSuspend({ data: { email, suspended } });
      toast.success(suspended ? "Cuenta suspendida" : "Cuenta reactivada");
      loadAll();
    } catch (err: any) {
      toast.error(err?.message ?? "No se pudo actualizar");
    }
  };


  const stats = useMemo(() => {
    const allDates: { fecha: string | null }[] = [
      ...trucks.flatMap((x) => [{ fecha: x.soap_vencimiento }, { fecha: x.permiso_circulacion_vencimiento }, { fecha: x.revision_tecnica_vencimiento }]),
      ...drivers.flatMap((x) => [{ fecha: x.licencia_vencimiento }, { fecha: x.carnet_vencimiento }]),
      ...profiles.map((x) => ({ fecha: x.poliza_seguro_vencimiento })),
    ];
    let vencidos = 0, porVencer = 0;
    for (const { fecha } of allDates) {
      const e = estadoVencimiento(fecha);
      if (e === "danger") vencidos++;
      else if (e === "warn" || e === "soon") porVencer++;
    }
    const activos = profiles.filter((p) => trucks.some((t) => t.user_id === p.id) || drivers.some((d) => d.user_id === p.id)).length;
    return { proveedores: profiles.length, activos, camiones: trucks.length, vencidos, porVencer };
  }, [profiles, trucks, drivers]);

  const flotaPorTipo = useMemo(() => {
    const m = new Map<string, number>();
    for (const t of trucks) {
      const k = t.tipo || "Sin tipo";
      m.set(k, (m.get(k) ?? 0) + 1);
    }
    return Array.from(m.entries()).map(([tipo, count]) => ({ tipo, count }));
  }, [trucks]);

  const filasProveedores = useMemo(() => {
    const invByEmail = new Map(invitations.map((i) => [i.email.toLowerCase(), i]));
    const linkedEmails = new Set<string>();
    const now = Date.now();

    const rows = profiles.map((p) => {
      const tc = trucks.filter((t) => t.user_id === p.id);
      const dc = drivers.filter((d) => d.user_id === p.id);
      const fechas = [
        ...tc.flatMap((x) => [x.soap_vencimiento, x.permiso_circulacion_vencimiento, x.revision_tecnica_vencimiento]),
        ...dc.flatMap((x) => [x.licencia_vencimiento, x.carnet_vencimiento]),
        p.poliza_seguro_vencimiento,
      ];
      let docStatus: "ok" | "warning" | "expired" = "ok";
      for (const f of fechas) {
        const e = estadoVencimiento(f);
        if (e === "danger") { docStatus = "expired"; break; }
        if (e === "warn" || e === "soon") docStatus = "warning";
      }
      const filled = PROFILE_FIELDS.filter((k) => !!p[k]).length;
      const completion = Math.round((filled / PROFILE_FIELDS.length) * 100);
      const hasData = tc.length > 0 || dc.length > 0;
      const inv = p.correo ? invByEmail.get(p.correo.toLowerCase()) : undefined;
      let status: SupplierStatus = hasData ? "activo" : "nuevo";
      if (inv?.status === "suspended") status = "suspendido";
      if (p.correo) linkedEmails.add(p.correo.toLowerCase());
      return {
        key: p.id, name: p.razon_social || "—", email: p.correo, rut: p.rut_empresa,
        region: p.region, trucks: tc.length, drivers: dc.length, docStatus, completion, status,
        deleted: !!(p as any).deleted_at, invitationId: inv?.id ?? null, hoursLeft: null as number | null,
        canResend: false,
      };
    });

    const pendingRows = invitations
      .filter((i) => (i.status === "invited" || i.status === "suspended") && !linkedEmails.has(i.email.toLowerCase()))
      .map((i) => {
        const ageHours = Math.floor((now - new Date(i.invited_at).getTime()) / 3_600_000);
        const hoursLeft = Math.max(0, 24 - ageHours);
        return {
          key: `inv-${i.id}`, name: i.company_name || "—", email: i.email, rut: i.rut, region: null as string | null,
          trucks: 0, drivers: 0, docStatus: "ok" as const, completion: 0,
          status: (i.status === "suspended" ? "suspendido" : "invitado") as SupplierStatus,
          deleted: false, invitationId: i.id, hoursLeft, canResend: ageHours >= 24 && i.status === "invited",
        };
      });

    return [...pendingRows, ...rows];
  }, [profiles, trucks, drivers, invitations]);


  const alertas = useMemo(() => {
    const items: { tipo: string; quien: string; supplier: string; dias: number }[] = [];
    const pMap = new Map(profiles.map((p) => [p.id, p.razon_social || p.nombre_contacto || p.correo || "—"]));
    for (const t of trucks) {
      const supplier = pMap.get(t.user_id) || "—";
      [["SOAP", t.soap_vencimiento], ["Permiso circ.", t.permiso_circulacion_vencimiento], ["Rev. técnica", t.revision_tecnica_vencimiento]].forEach(([tipo, f]) => {
        const d = diasHasta(f as string | null);
        if (d !== null && d <= 30) items.push({ tipo: tipo as string, quien: t.patente, supplier, dias: d });
      });
    }
    for (const dr of drivers) {
      const supplier = pMap.get(dr.user_id) || "—";
      const d = diasHasta(dr.licencia_vencimiento);
      if (d !== null && d <= 30) items.push({ tipo: "Licencia", quien: dr.nombre_completo, supplier, dias: d });
    }
    return items.sort((a, b) => a.dias - b.dias);
  }, [profiles, trucks, drivers]);

  const cumplimiento = useMemo(() => {
    const tally = (fechas: (string | null | undefined)[]) => {
      const total = fechas.filter((f) => f).length;
      const valid = fechas.filter((f) => estadoVencimiento(f) === "ok").length;
      return { total, valid };
    };
    return [
      { label: "SOAP", ...tally(trucks.map((t) => t.soap_vencimiento)) },
      { label: "Permiso de circulación", ...tally(trucks.map((t) => t.permiso_circulacion_vencimiento)) },
      { label: "Revisión técnica", ...tally(trucks.map((t) => t.revision_tecnica_vencimiento)) },
      { label: "Pólizas de seguro", ...tally(profiles.map((p) => p.poliza_seguro_vencimiento)) },
    ];
  }, [trucks, profiles]);

  if (checking) return <p className="text-muted-foreground">Verificando permisos...</p>;
  if (!isAdmin) {
    return (
      <div className="mx-auto max-w-md rounded-xl border bg-card p-8 text-center shadow-sm">
        <ShieldAlert className="mx-auto h-12 w-12 text-destructive" />
        <h1 className="mt-4 text-2xl font-bold">Acceso restringido</h1>
        <p className="mt-2 text-muted-foreground">Esta vista es sólo para administradores de TN Chile.</p>
      </div>
    );
  }
  if (loading) return <p className="text-muted-foreground">Cargando datos...</p>;

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold">Panel de Administración</h1>
          <p className="text-muted-foreground">Vista global de todos los proveedores TN Chile.</p>
        </div>
        <label className="inline-flex cursor-pointer items-center gap-2 rounded-md border bg-card px-3 py-2 text-sm shadow-sm">
          <input type="checkbox" checked={showDeleted} onChange={(e) => setShowDeleted(e.target.checked)} className="h-4 w-4 accent-primary" />
          Mostrar eliminados
        </label>
      </div>

      <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-5">
        <StatCard icon={Users} label="Proveedores" value={stats.proveedores} sub={`${stats.activos} activos`} />
        <StatCard icon={Truck} label="Camiones" value={stats.camiones} />
        <StatCard icon={Users} label="Choferes" value={drivers.length} />
        <StatCard icon={FileText} label="Por vencer (≤30d)" value={stats.porVencer} tone="warn" />
        <StatCard icon={AlertTriangle} label="Vencidos" value={stats.vencidos} tone="danger" />
      </div>

      <div className="rounded-xl border bg-card p-6 shadow-sm">
        <h2 className="mb-4 text-lg font-semibold">Cumplimiento documental</h2>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {cumplimiento.map((c) => <ComplianceBar key={c.label} {...c} />)}
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="rounded-xl border bg-card p-6 shadow-sm lg:col-span-1">
          <h2 className="mb-4 text-lg font-semibold">Flota por tipo de camión</h2>
          <Donut data={flotaPorTipo} />
        </div>

        <div className="rounded-xl border bg-card p-6 shadow-sm lg:col-span-2">
          <h2 className="mb-4 text-lg font-semibold">Alertas críticas</h2>
          {alertas.length === 0 ? (
            <p className="text-sm text-muted-foreground">Sin alertas. Todo al día.</p>
          ) : (
            <ul className="max-h-80 space-y-2 overflow-y-auto pr-2">
              {alertas.map((a, i) => {
                const venc = a.dias < 0;
                return (
                  <li key={i} className={`flex items-center justify-between gap-3 rounded-md border px-3 py-2 text-sm ${venc ? "border-destructive/40 bg-destructive/10" : a.dias <= 15 ? "border-orange/40 bg-orange/10" : "border-warning/40 bg-warning/15"}`}>
                    <div className="min-w-0">
                      <p className="truncate font-medium">{a.tipo} — {a.quien}</p>
                      <p className="truncate text-xs text-muted-foreground">{a.supplier}</p>
                    </div>
                    <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold ${venc ? "bg-destructive text-destructive-foreground" : a.dias <= 15 ? "bg-orange text-orange-foreground" : "bg-warning text-warning-foreground"}`}>
                      {venc ? `vencido hace ${-a.dias}d` : `${a.dias}d`}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
      <div className="rounded-xl border bg-card p-6 shadow-sm">
        <h2 className="mb-1 flex items-center gap-2 text-lg font-semibold"><Mail className="h-5 w-5 text-primary" /> Invitar proveedor</h2>
        <p className="mb-4 text-sm text-muted-foreground">Envía una invitación por correo. El proveedor recibirá un enlace para activar su cuenta.</p>
        <form onSubmit={handleInvite} className="grid gap-3 md:grid-cols-3">
          <input required type="email" value={invEmail} onChange={(e) => setInvEmail(e.target.value)} placeholder="correo@empresa.cl"
            className="rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
          <input value={invCompany} onChange={(e) => setInvCompany(e.target.value)} placeholder="Razón social (opcional)"
            className="rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
          <input value={invRut} onChange={(e) => setInvRut(e.target.value)} placeholder="RUT (opcional)"
            className="rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
          <textarea value={invNotes} onChange={(e) => setInvNotes(e.target.value)} placeholder="Notas internas (opcional)" rows={2}
            className="md:col-span-3 rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
          <button disabled={sending} type="submit"
            className="md:col-span-3 inline-flex items-center justify-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow hover:bg-primary/90 disabled:opacity-60">
            <Send className="h-4 w-4" /> {sending ? "Enviando..." : "Enviar invitación"}
          </button>
        </form>
      </div>

      <div className="rounded-xl border bg-card shadow-sm">
        <div className="border-b px-6 py-4">
          <h2 className="text-lg font-semibold">Proveedores</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-primary-soft text-left text-xs uppercase tracking-wide text-primary-dark">
              <tr>
                <th className="px-4 py-3">Proveedor</th>
                <th className="px-4 py-3">RUT</th>
                <th className="px-4 py-3">Región</th>
                <th className="px-4 py-3 text-center">Camiones</th>
                <th className="px-4 py-3 text-center">Choferes</th>
                <th className="px-4 py-3">Estado</th>
                <th className="px-4 py-3">Documentos</th>
                <th className="px-4 py-3">Perfil</th>
                <th className="px-4 py-3">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {filasProveedores.map((r) => (
                <tr key={r.key} className={`border-t ${r.deleted ? "bg-destructive/5 text-muted-foreground line-through" : ""}`}>
                  <td className="px-4 py-3">
                    <p className="font-medium">
                      {r.name}
                      {r.deleted && <span className="ml-2 rounded-full bg-destructive/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-destructive no-underline">Eliminado</span>}
                    </p>
                    <p className="text-xs text-muted-foreground">{r.email}</p>
                  </td>
                  <td className="px-4 py-3 text-sm">{r.rut || "—"}</td>
                  <td className="px-4 py-3">{r.region || "—"}</td>
                  <td className="px-4 py-3 text-center">{r.trucks}</td>
                  <td className="px-4 py-3 text-center">{r.drivers}</td>
                  <td className="px-4 py-3"><StatusBadge status={r.status} hoursLeft={r.status === "invitado" ? r.hoursLeft : null} /></td>
                  <td className="px-4 py-3">{r.status === "invitado" || r.status === "suspendido" ? <span className="text-xs text-muted-foreground">—</span> : <DocBadge status={r.docStatus} />}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div className="h-2 w-24 overflow-hidden rounded-full bg-muted">
                        <div className="h-full bg-primary" style={{ width: `${r.completion}%` }} />
                      </div>
                      <span className="text-xs text-muted-foreground">{r.completion}%</span>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap items-center gap-2">
                      {r.canResend && r.invitationId && r.email && (
                        <button onClick={() => handleResend(r.invitationId!, r.email!)}
                          className="inline-flex items-center gap-1 rounded-md border border-primary/40 px-2 py-1 text-xs font-medium text-primary hover:bg-primary/10">
                          <Send className="h-3 w-3" /> Reenviar
                        </button>
                      )}
                      {r.email && r.status !== "invitado" && (
                        <label className="inline-flex cursor-pointer items-center gap-2 text-xs">
                          <input type="checkbox" className="h-4 w-4 accent-primary"
                            checked={r.status !== "suspendido"}
                            onChange={(e) => handleToggleSuspension(r.email!, !e.target.checked)} />
                          {r.status === "suspendido" ? "Suspendida" : "Activa"}
                        </label>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="rounded-xl border bg-card p-6 shadow-sm">
        <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold">
          <Activity className="h-5 w-5 text-primary" /> Actividad reciente
        </h2>
        {audit.length === 0 ? (
          <p className="text-sm text-muted-foreground">Sin actividad registrada todavía.</p>
        ) : (
          <ul className="divide-y">
            {audit.map((e) => (
              <li key={e.id} className="flex flex-wrap items-center justify-between gap-3 py-3 text-sm">
                <div className="flex items-center gap-3 min-w-0">
                  <ActionBadge action={e.accion} />
                  <div className="min-w-0">
                    <p className="truncate font-medium">
                      {TABLE_LABEL[e.tabla_nombre] ?? e.tabla_nombre} · {recordName(e)}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">{e.usuario_email || "sistema"}</p>
                  </div>
                </div>
                <span className="shrink-0 text-xs text-muted-foreground">{timeAgo(e.created_at)}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function ActionBadge({ action }: { action: "INSERT" | "UPDATE" | "DELETE" }) {
  const cfg = {
    INSERT: { label: "Creado", cls: "bg-success/15 text-success" },
    UPDATE: { label: "Editado", cls: "bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-300" },
    DELETE: { label: "Eliminado", cls: "bg-destructive/15 text-destructive" },
  }[action];
  return <span className={`inline-flex shrink-0 rounded-full px-2.5 py-0.5 text-xs font-semibold ${cfg.cls}`}>{cfg.label}</span>;
}

function StatusBadge({ status, hoursLeft }: { status: SupplierStatus; hoursLeft?: number | null }) {
  const cfg = {
    invitado: { label: "Invitado", cls: "bg-warning/30 text-warning-foreground" },
    nuevo: { label: "Nuevo", cls: "bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-300" },
    activo: { label: "Activo", cls: "bg-success/15 text-success" },
    suspendido: { label: "Suspendido", cls: "bg-destructive/15 text-destructive" },
  }[status];
  const extra = status === "invitado" && hoursLeft != null && hoursLeft > 0 ? ` · ${hoursLeft}h` : "";
  return <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${cfg.cls}`}>{cfg.label}{extra}</span>;
}


function StatCard({ icon: Icon, label, value, sub, tone }: { icon: any; label: string; value: number; sub?: string; tone?: "warn" | "danger" }) {
  const color = tone === "danger" ? "text-destructive" : tone === "warn" ? "text-orange" : "text-primary";
  return (
    <div className="rounded-xl border bg-card p-5 shadow-sm">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-muted-foreground">{label}</p>
        <Icon className={`h-5 w-5 ${color}`} />
      </div>
      <p className={`mt-2 text-3xl font-bold ${color}`}>{value}</p>
      {sub && <p className="mt-1 text-xs text-muted-foreground">{sub}</p>}
    </div>
  );
}

function ComplianceBar({ label, valid, total }: { label: string; valid: number; total: number }) {
  const pct = total === 0 ? 0 : Math.round((valid / total) * 100);
  const tone = total === 0 ? "bg-muted-foreground/30" : pct >= 80 ? "bg-primary" : pct >= 50 ? "bg-warning" : "bg-destructive";
  return (
    <div>
      <div className="mb-1 flex items-center justify-between text-sm">
        <span className="font-medium">{label}</span>
        <span className="text-muted-foreground">{valid}/{total || 0} <span className="ml-1 text-xs">({pct}%)</span></span>
      </div>
      <div className="h-2.5 w-full overflow-hidden rounded-full bg-muted">
        <div className={`h-full ${tone} transition-all`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}


function DocBadge({ status }: { status: "ok" | "warning" | "expired" }) {
  const cfg = {
    ok: { label: "OK", cls: "bg-success/15 text-success" },
    warning: { label: "Por vencer", cls: "bg-warning/30 text-warning-foreground" },
    expired: { label: "Vencido", cls: "bg-destructive/15 text-destructive" },
  }[status];
  return <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${cfg.cls}`}>{cfg.label}</span>;
}

const DONUT_COLORS = ["#2D7A45", "#1E5C32", "#5BA372", "#A3D4B5", "#0F3A1F", "#7BBF92"];

function Donut({ data }: { data: { tipo: string; count: number }[] }) {
  const total = data.reduce((s, d) => s + d.count, 0);
  if (total === 0) return <p className="text-sm text-muted-foreground">Sin camiones registrados.</p>;
  const r = 60, c = 2 * Math.PI * r;
  let acc = 0;
  return (
    <div className="flex flex-col items-center gap-4">
      <svg viewBox="0 0 160 160" className="h-48 w-48 -rotate-90">
        <circle cx="80" cy="80" r={r} fill="none" stroke="hsl(var(--muted))" strokeWidth="22" />
        {data.map((d, i) => {
          const frac = d.count / total;
          const dash = frac * c;
          const offset = c - acc * c;
          acc += frac;
          return <circle key={d.tipo} cx="80" cy="80" r={r} fill="none" stroke={DONUT_COLORS[i % DONUT_COLORS.length]} strokeWidth="22" strokeDasharray={`${dash} ${c - dash}`} strokeDashoffset={offset} />;
        })}
        <text x="80" y="80" textAnchor="middle" dominantBaseline="central" transform="rotate(90 80 80)" className="fill-foreground text-xl font-bold">{total}</text>
      </svg>
      <ul className="w-full space-y-1 text-sm">
        {data.map((d, i) => (
          <li key={d.tipo} className="flex items-center justify-between">
            <span className="flex items-center gap-2">
              <span className="h-3 w-3 rounded-sm" style={{ background: DONUT_COLORS[i % DONUT_COLORS.length] }} />
              {d.tipo}
            </span>
            <span className="text-muted-foreground">{d.count} ({Math.round((d.count / total) * 100)}%)</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
