import { createFileRoute } from "@tanstack/react-router";
import { pageHead } from "@/lib/page-head";
import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ShieldCheck, Briefcase, Mail, Search, UserPlus, Loader2, Handshake, Upload } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { requireAdmin } from "@/lib/require-admin";
import {
  listAppUsers,
  setStaffRole,
  inviteStaff,
  type AppUser,
  type StaffRole,
} from "@/lib/user-roles.functions";
import { SkeletonRows } from "@/components/SkeletonBlocks";

export const Route = createFileRoute("/_app/admin-usuarios")({
  head: () =>
    pageHead(
      "/admin-usuarios",
      "Usuarios y roles · Administración TN Chile",
      "Invita miembros del equipo TN Chile y otorga o revoca permisos de administrador y operador desde un solo panel.",
    ),
  ssr: false,
  beforeLoad: requireAdmin,
  component: AdminUsuariosPage,
});

const ROLE_LABEL: Record<string, string> = {
  admin: "Administrador",
  operador: "Operador",
  comercial: "Comercial",
  lider_cuenta: "Líder de Cuenta",
  jefe_operaciones: "Jefe de Operaciones",
  supplier: "Proveedor",
  cliente: "Cliente",
  chofer: "Chofer",
};

function RoleChip({ role }: { role: string }) {
  const tone =
    role === "admin"
      ? "bg-primary text-primary-foreground"
      : role === "operador" || role === "comercial" || role === "lider_cuenta" || role === "jefe_operaciones"
        ? "bg-primary-soft text-primary-dark"
        : "bg-muted text-muted-foreground";
  return (
    <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${tone}`}>
      {ROLE_LABEL[role] ?? role}
    </span>
  );
}

function SubirDocumentoPrivado({ users }: { users: AppUser[] }) {
  const [target, setTarget] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);

  async function subir(e: React.FormEvent) {
    e.preventDefault();
    if (!target || !file) return;
    setUploading(true);
    try {
      const { error } = await supabase.storage
        .from("documentos-privados")
        .upload(`${target}/${file.name}`, file, { upsert: true });
      if (error) throw new Error(error.message);
      toast.success("Documento subido al espacio privado del usuario.");
      setFile(null);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo subir el documento.");
    } finally {
      setUploading(false);
    }
  }

  return (
    <section className="rounded-xl border bg-card p-4 shadow-sm">
      <h2 className="flex items-center gap-2 text-sm font-semibold">
        <Upload className="h-4 w-4 text-primary" /> Subir documento privado
      </h2>
      <form onSubmit={subir} className="mt-3 flex flex-wrap items-end gap-3">
        <div className="min-w-[240px] flex-1">
          <label className="mb-1 block text-xs font-medium text-muted-foreground">Usuario</label>
          <select
            required
            value={target}
            onChange={(e) => setTarget(e.target.value)}
            className="w-full rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
          >
            <option value="">Selecciona un usuario…</option>
            {users.map((u) => (
              <option key={u.id} value={u.id}>
                {u.email}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-muted-foreground">Archivo</label>
          <input
            required
            type="file"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            className="block rounded-md border bg-background px-3 py-1.5 text-sm"
          />
        </div>
        <button
          type="submit"
          disabled={uploading || !target || !file}
          className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary-dark disabled:opacity-60"
        >
          {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
          Subir documento
        </button>
      </form>
      <p className="mt-2 text-xs text-muted-foreground">
        El archivo queda en la carpeta privada del usuario y solo él (y Administración) puede verlo.
      </p>
    </section>
  );
}

function AdminUsuariosPage() {
  const qc = useQueryClient();
  const [q, setQ] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<StaffRole>("operador");
  const [sending, setSending] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);

  const { data: users, isLoading } = useQuery({
    queryKey: ["app-users"],
    queryFn: () => listAppUsers({ data: {} as never }),
  });

  const visible = useMemo(() => {
    const t = q.trim().toLowerCase();
    if (!t) return users ?? [];
    return (users ?? []).filter(
      (u) =>
        u.email.toLowerCase().includes(t) ||
        (u.razon_social ?? "").toLowerCase().includes(t),
    );
  }, [users, q]);

  const staffCount = (users ?? []).filter((u) =>
    u.roles.some((r) => r === "admin" || r === "operador" || r === "comercial"),
  ).length;

  async function toggle(u: AppUser, r: StaffRole) {
    const grant = !u.roles.includes(r);
    setBusy(`${u.id}:${r}`);
    try {
      await setStaffRole({ data: { user_id: u.id, role: r, grant } });
      await qc.invalidateQueries({ queryKey: ["app-users"] });
      toast.success(
        grant ? `${ROLE_LABEL[r]} otorgado a ${u.email}` : `${ROLE_LABEL[r]} revocado a ${u.email}`,
      );
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo actualizar el rol.");
    } finally {
      setBusy(null);
    }
  }

  async function handleInvite(e: React.FormEvent) {
    e.preventDefault();
    setSending(true);
    try {
      const res = await inviteStaff({ data: { email, role } });
      toast.success(
        res.invited
          ? `Invitación enviada a ${res.email} como ${ROLE_LABEL[role]}.`
          : `${res.email} ya tenía cuenta: se le asignó ${ROLE_LABEL[role]}.`,
      );
      setEmail("");
      await qc.invalidateQueries({ queryKey: ["app-users"] });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo invitar.");
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold text-primary-dark">Usuarios y roles</h1>
        <p className="text-sm text-muted-foreground">
          Invita al equipo TN Chile por correo y otorga permisos de administrador u operador.
          {" "}
          <strong>{staffCount}</strong> con acceso interno.
        </p>
      </header>

      <section className="rounded-xl border bg-card p-4 shadow-sm">
        <h2 className="flex items-center gap-2 text-sm font-semibold">
          <UserPlus className="h-4 w-4 text-primary" /> Invitar miembro del equipo
        </h2>
        <form onSubmit={handleInvite} className="mt-3 flex flex-wrap items-end gap-3">
          <div className="min-w-[220px] flex-1">
            <label className="mb-1 block text-xs font-medium text-muted-foreground">Correo</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="persona@tnchile.cl"
              className="w-full rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-muted-foreground">Rol</label>
            <select
              value={role}
              onChange={(e) => setRole(e.target.value as StaffRole)}
              className="rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            >
              <option value="operador">Operador</option>
              <option value="comercial">Comercial</option>
              <option value="lider_cuenta">Líder de Cuenta</option>
              <option value="jefe_operaciones">Jefe de Operaciones</option>
              <option value="admin">Administrador</option>
            </select>
          </div>
          <button
            type="submit"
            disabled={sending}
            className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary-dark disabled:opacity-60"
          >
            {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mail className="h-4 w-4" />}
            Enviar invitación
          </button>
        </form>
        <p className="mt-2 text-xs text-muted-foreground">
          Si el correo ya tiene cuenta, no se envía invitación: solo se le asigna el rol.
          El <strong>operador</strong> accede al espacio Operaciones (disponibilidad, asignaciones).
          El <strong>comercial</strong> accede al espacio Comercial (agenda, pipeline, solicitudes,
          cotizaciones). Un usuario puede tener ambos roles simultáneamente.
        </p>
      </section>

      <SubirDocumentoPrivado users={users ?? []} />



      <section className="rounded-xl border bg-card p-4 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-sm font-semibold">Todos los usuarios</h2>
          <div className="relative">
            <Search className="pointer-events-none absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Buscar correo o empresa…"
              className="rounded-md border bg-background py-2 pl-8 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>
        </div>

        {isLoading && <div className="mt-4"><SkeletonRows /></div>}

        {!isLoading && (
          <ul className="mt-4 space-y-2">
            {visible.map((u) => (
              <li
                key={u.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-lg border p-3"
              >
                <div className="min-w-[200px]">
                  <div className="text-sm font-semibold">{u.email}</div>
                  <div className="text-xs text-muted-foreground">
                    {u.razon_social ?? "—"}
                    {u.last_sign_in_at
                      ? ` · último ingreso ${new Date(u.last_sign_in_at).toLocaleDateString("es-CL")}`
                      : " · nunca ha ingresado"}
                  </div>
                  <div className="mt-1 flex flex-wrap gap-1">
                    {u.roles.length === 0 ? (
                      <span className="text-[11px] text-muted-foreground">Sin rol</span>
                    ) : (
                      u.roles.map((r) => <RoleChip key={r} role={r} />)
                    )}
                  </div>
                </div>
                <div className="flex gap-2">
                  {(["operador", "comercial", "lider_cuenta", "jefe_operaciones", "admin"] as StaffRole[]).map((r) => {
                    const active = u.roles.includes(r);
                    const Icon =
                      r === "admin"
                        ? ShieldCheck
                        : r === "comercial" || r === "lider_cuenta"
                          ? Handshake
                          : Briefcase;
                    return (
                      <button
                        key={r}
                        onClick={() => toggle(u, r)}
                        disabled={busy === `${u.id}:${r}`}
                        className={`inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-xs font-medium transition-colors disabled:opacity-60 ${
                          active
                            ? "border-primary bg-primary text-primary-foreground hover:bg-primary-dark"
                            : "hover:bg-muted"
                        }`}
                      >
                        {busy === `${u.id}:${r}` ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <Icon className="h-3.5 w-3.5" />
                        )}
                        {active ? `Quitar ${ROLE_LABEL[r].toLowerCase()}` : `Hacer ${ROLE_LABEL[r].toLowerCase()}`}
                      </button>
                    );
                  })}
                </div>
              </li>
            ))}
            {visible.length === 0 && (
              <li className="py-6 text-center text-sm text-muted-foreground">
                No hay usuarios que coincidan.
              </li>
            )}
          </ul>
        )}
      </section>
    </div>
  );
}
