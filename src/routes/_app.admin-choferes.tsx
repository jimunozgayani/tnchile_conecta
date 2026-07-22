import { createFileRoute, Navigate } from "@tanstack/react-router";
import { pageHead } from "@/lib/page-head";
import { useEffect, useMemo, useState } from "react";
import { Mail, Search } from "lucide-react";
import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { inviteDriver } from "@/lib/driver-invitations.functions";

export const Route = createFileRoute("/_app/admin-choferes")({
  head: () => pageHead("/admin-choferes", "Invitar choferes · Admin TN Chile", "Panel administrativo para enviar invitaciones a choferes de cualquier proveedor y monitorear el estado de sus cuentas."),
  component: AdminChoferesPage,
});

const norm = (s: string | null | undefined) => (s ?? "").toLowerCase().replace(/[^0-9k]/g, "");

function AdminChoferesPage() {
  const [allowed, setAllowed] = useState<boolean | null>(null);
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [inviting, setInviting] = useState<string | null>(null);
  const invite = useServerFn(inviteDriver);

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setAllowed(false); return; }
      const { data } = await supabase.from("user_roles").select("role").eq("user_id", user.id).eq("role", "admin").maybeSingle();
      setAllowed(!!data);
    })();
  }, []);

  const load = async () => {
    setLoading(true);
    const [{ data: drivers }, { data: profiles }, { data: invs }, { data: perfiles }] = await Promise.all([
      supabase.from("drivers").select("id,user_id,nombre_completo,rut,email,celular").is("deleted_at", null),
      supabase.from("profiles").select("id,razon_social"),
      supabase.from("driver_invitations").select("driver_id,estado,expires_at,created_at").order("created_at", { ascending: false }),
      supabase.from("chofer_perfiles").select("proveedor_id,rut"),
    ]);
    const provName: Record<string, string> = {};
    for (const p of profiles ?? []) provName[p.id] = p.razon_social ?? "—";
    const perfilPairs = new Set((perfiles ?? []).map((p: any) => `${p.proveedor_id}::${norm(p.rut)}`));
    const latest: Record<string, any> = {};
    for (const i of invs ?? []) if (!latest[i.driver_id]) latest[i.driver_id] = i;
    const merged = (drivers ?? []).map((d: any) => {
      let st: "active" | "pending" | "expired" | "none" = "none";
      if (perfilPairs.has(`${d.user_id}::${norm(d.rut)}`)) st = "active";
      else {
        const inv = latest[d.id];
        if (inv && inv.estado === "pendiente") st = new Date(inv.expires_at).getTime() < Date.now() ? "expired" : "pending";
      }
      return { ...d, proveedor: provName[d.user_id] ?? "—", status: st };
    });
    setRows(merged);
    setLoading(false);
  };

  useEffect(() => { if (allowed) load(); }, [allowed]);

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return rows;
    return rows.filter((r) =>
      r.nombre_completo?.toLowerCase().includes(s) ||
      r.rut?.toLowerCase().includes(s) ||
      r.email?.toLowerCase().includes(s) ||
      r.proveedor?.toLowerCase().includes(s));
  }, [rows, q]);

  const handleInvite = async (r: any) => {
    if (!r.email) { toast.error("El chofer no tiene correo. Pide al proveedor que lo agregue."); return; }
    setInviting(r.id);
    try {
      await invite({ data: { driver_id: r.id } });
      toast.success(`Invitación enviada a ${r.email}`);
      load();
    } catch (e: any) { toast.error(e.message ?? "Error al invitar"); }
    finally { setInviting(null); }
  };

  if (allowed === false) return <Navigate to="/dashboard" />;
  if (allowed === null) return <p className="text-muted-foreground">Cargando...</p>;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Invitar choferes</h1>
        <p className="text-muted-foreground">Gestiona invitaciones para que los choferes activen su cuenta.</p>
      </div>

      <div className="relative max-w-md">
        <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar nombre, RUT, correo o proveedor..."
          className="w-full rounded-md border border-input bg-background py-2 pl-9 pr-3 text-sm" />
      </div>

      <div className="overflow-x-auto rounded-xl border bg-card shadow-sm">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-left text-xs uppercase text-muted-foreground">
            <tr>
              <th className="px-4 py-3">Chofer</th>
              <th className="px-4 py-3">RUT</th>
              <th className="px-4 py-3">Correo</th>
              <th className="px-4 py-3">Proveedor</th>
              <th className="px-4 py-3">Estado</th>
              <th className="px-4 py-3 text-right">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {loading ? (
              <tr><td colSpan={6} className="px-4 py-6 text-center text-muted-foreground">Cargando...</td></tr>
            ) : filtered.length === 0 ? (
              <tr><td colSpan={6} className="px-4 py-6 text-center text-muted-foreground">Sin resultados.</td></tr>
            ) : filtered.map((r) => (
              <tr key={r.id}>
                <td className="px-4 py-3 font-medium">{r.nombre_completo}</td>
                <td className="px-4 py-3">{r.rut ?? "—"}</td>
                <td className="px-4 py-3">{r.email ?? <span className="text-muted-foreground">—</span>}</td>
                <td className="px-4 py-3">{r.proveedor}</td>
                <td className="px-4 py-3">
                  {r.status === "active" && <span className="rounded-full bg-success/15 px-2 py-0.5 text-xs font-medium text-success">Cuenta activa</span>}
                  {r.status === "pending" && <span className="rounded-full bg-primary-soft px-2 py-0.5 text-xs font-medium text-primary">Invitación pendiente</span>}
                  {r.status === "expired" && <span className="rounded-full bg-destructive/15 px-2 py-0.5 text-xs font-medium text-destructive">Invitación expirada</span>}
                  {r.status === "none" && <span className="text-xs text-muted-foreground">Sin invitación</span>}
                </td>
                <td className="px-4 py-3 text-right">
                  {r.status !== "active" && (
                    <button onClick={() => handleInvite(r)} disabled={inviting === r.id || !r.email}
                      className="inline-flex items-center gap-1 rounded-md border border-primary px-2.5 py-1 text-xs text-primary hover:bg-primary-soft disabled:opacity-50">
                      <Mail className="h-3.5 w-3.5" />
                      {inviting === r.id ? "Enviando..." : r.status === "pending" ? "Reenviar" : "Invitar"}
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
