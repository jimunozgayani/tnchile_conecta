import { createFileRoute } from "@tanstack/react-router";
import { pageHead } from "@/lib/page-head";
import { useEffect, useState } from "react";
import { Plus, Trash2, X, Mail } from "lucide-react";
import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { CLASES_LICENCIA } from "@/lib/regions";
import { StatusBadge } from "@/components/StatusBadge";
import { validateUpload } from "@/lib/upload-validation";
import { inviteDriver } from "@/lib/driver-invitations.functions";
import { saveOwnerDriver } from "@/lib/owner-driver.functions";

export const Route = createFileRoute("/_app/choferes")({
  head: () => pageHead("/choferes", "Mis choferes · Portal Proveedores TN Chile", "Gestiona los choferes de tu empresa en TN Chile: licencias, documentos, vigencias y camiones asignados a cada conductor."),
  component: ChoferesPage,
});

const EMPTY = {
  nombre_completo: "", rut: "", email: "", celular: "", clase_licencia: "A1",
  licencia_vencimiento: "", carnet_vencimiento: "", foto_url: "",
  es_dueno_conductor: false,
};

const norm = (s: string | null | undefined) =>
  (s ?? "").toLowerCase().replace(/[^0-9k]/g, "");

type InvStatus = "active" | "pending" | "expired" | "owner" | "none";

function ChoferesPage() {
  const [items, setItems] = useState<any[]>([]);
  const [photoUrls, setPhotoUrls] = useState<Record<string, string>>({});
  const [statuses, setStatuses] = useState<Record<string, InvStatus>>({});
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<any>(EMPTY);
  const [editing, setEditing] = useState<string | null>(null);
  const [userId, setUserId] = useState("");
  const [inviting, setInviting] = useState<string | null>(null);
  const invite = useServerFn(inviteDriver);
  const saveOwner = useServerFn(saveOwnerDriver);

  const load = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) setUserId(user.id);
    const { data } = await supabase.from("drivers").select("*").is("deleted_at", null).order("created_at", { ascending: false });
    const drivers = data ?? [];
    setItems(drivers);

    // Determine account status per driver
    const ids = drivers.map((d: any) => d.id);
    const [{ data: invs }, { data: perfiles }] = await Promise.all([
      ids.length
        ? supabase.from("driver_invitations").select("driver_id,estado,expires_at,created_at")
            .in("driver_id", ids).order("created_at", { ascending: false })
        : Promise.resolve({ data: [] as any[] }),
      user
        ? supabase.from("chofer_perfiles").select("rut,user_id,estado_validacion").eq("proveedor_id", user.id)
        : Promise.resolve({ data: [] as any[] }),
    ]);
    const perfilRuts = new Set((perfiles ?? []).map((p: any) => norm(p.rut)));
    const ownerRuts = new Set(
      (perfiles ?? []).filter((p: any) => p.user_id === user?.id).map((p: any) => norm(p.rut))
    );
    const latestByDriver: Record<string, any> = {};
    for (const i of invs ?? []) if (!latestByDriver[i.driver_id]) latestByDriver[i.driver_id] = i;
    const st: Record<string, InvStatus> = {};
    for (const d of drivers) {
      if (ownerRuts.has(norm(d.rut))) { st[d.id] = "owner"; continue; }
      if (perfilRuts.has(norm(d.rut))) { st[d.id] = "active"; continue; }
      const inv = latestByDriver[d.id];
      if (!inv) { st[d.id] = "none"; continue; }
      if (inv.estado !== "pendiente") { st[d.id] = "none"; continue; }
      st[d.id] = new Date(inv.expires_at).getTime() < Date.now() ? "expired" : "pending";
    }
    setStatuses(st);

    const urls: Record<string, string> = {};
    for (const d of drivers) {
      if (d.foto_url) {
        const { data: s } = await supabase.storage.from("driver-photos").createSignedUrl(d.foto_url, 3600);
        if (s?.signedUrl) urls[d.id] = s.signedUrl;
      }
    }
    setPhotoUrls(urls);
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const handleInvite = async (d: any) => {
    if (!d.email) { toast.error("Agrega un correo al chofer primero."); return; }
    setInviting(d.id);
    try {
      const r = await invite({ data: { driver_id: d.id } });
      toast.success(`Invitación enviada a ${r.email}`);
      load();
    } catch (e: any) {
      toast.error(e.message ?? "No se pudo enviar la invitación");
    } finally { setInviting(null); }
  };

  const uploadPhoto = async (file: File) => {
    const v = validateUpload(file);
    if (!v.ok) return toast.error(v.error);
    const path = `${userId}/${Date.now()}-${file.name}`;
    const { error } = await supabase.storage.from("driver-photos").upload(path, file);
    if (error) return toast.error(error.message);
    setForm((f: any) => ({ ...f, foto_url: path }));
    toast.success("Foto cargada");
  };

  const save = async () => {
    if (form.es_dueno_conductor) {
      try {
        await saveOwner({ data: {
          driver_id: editing ?? undefined,
          nombre_completo: form.nombre_completo,
          rut: form.rut,
          email: form.email || null,
          celular: form.celular || null,
          clase_licencia: form.clase_licencia,
          licencia_vencimiento: form.licencia_vencimiento || null,
          carnet_vencimiento: form.carnet_vencimiento || null,
          foto_url: form.foto_url || null,
        }});
        toast.success(editing ? "Actualizado" : "Agregado como dueño-conductor");
        setOpen(false); load();
      } catch (e: any) {
        toast.error(e.message ?? "No se pudo guardar");
      }
      return;
    }
    const payload: any = { ...form, user_id: userId };
    delete payload.es_dueno_conductor;
    ["licencia_vencimiento", "carnet_vencimiento"].forEach((k) => { if (!payload[k]) payload[k] = null; });
    if (payload.email) payload.email = String(payload.email).trim().toLowerCase();
    else payload.email = null;
    const res = editing
      ? await supabase.from("drivers").update(payload).eq("id", editing)
      : await supabase.from("drivers").insert(payload);
    if (res.error) toast.error(res.error.message);
    else { toast.success(editing ? "Actualizado" : "Agregado"); setOpen(false); load(); }
  };

  const remove = async (id: string) => {
    if (!confirm("¿Eliminar este chofer?")) return;
    const { error } = await supabase.from("drivers").update({ deleted_at: new Date().toISOString() }).eq("id", id);
    if (error) toast.error(error.message);
    else { toast.success("Eliminado"); load(); }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Choferes</h1>
          <p className="text-muted-foreground">Conductores y vencimientos de licencia.</p>
        </div>
        <button onClick={() => { setForm(EMPTY); setEditing(null); setOpen(true); }}
          className="flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary-dark">
          <Plus className="h-4 w-4" /> Nuevo chofer
        </button>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {loading ? <p className="text-muted-foreground">Cargando...</p>
          : items.length === 0 ? <p className="text-muted-foreground">Aún no hay choferes registrados.</p>
          : items.map((d) => (
            <div key={d.id} className="rounded-xl border bg-card p-5 shadow-sm">
              <div className="flex items-center gap-3">
                {d.foto_url && photoUrls[d.id] ? (
                  <img src={photoUrls[d.id]}
                    alt="" className="h-14 w-14 rounded-full object-cover" />

                ) : (
                  <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary-soft font-semibold text-primary">
                    {d.nombre_completo?.[0] ?? "?"}
                  </div>
                )}
                <div className="flex-1">
                  <p className="font-semibold">{d.nombre_completo}</p>
                  <p className="text-xs text-muted-foreground">{d.rut} · Lic. {d.clase_licencia}</p>
                </div>
              </div>
              <div className="mt-3 space-y-1 text-sm">
                <p className="text-muted-foreground">📱 {d.celular || "—"}</p>
                <p className="text-muted-foreground truncate">✉️ {d.email || "—"}</p>
                <div className="flex flex-wrap gap-1.5 pt-2">
                  <StatusBadge fecha={d.licencia_vencimiento} label="Licencia" />
                  <StatusBadge fecha={d.carnet_vencimiento} label="Carnet" />
                  <AccountBadge status={statuses[d.id] ?? "none"} />
                </div>
              </div>
              <div className="mt-3 flex items-center justify-end gap-3 border-t pt-3 text-sm">
                {statuses[d.id] !== "active" && statuses[d.id] !== "owner" && (
                  <button onClick={() => handleInvite(d)} disabled={inviting === d.id}
                    className="flex items-center gap-1 rounded-md border border-primary px-2.5 py-1 text-primary hover:bg-primary-soft disabled:opacity-50">
                    <Mail className="h-3.5 w-3.5" />
                    {inviting === d.id ? "Enviando..." : statuses[d.id] === "pending" ? "Reenviar" : "Invitar"}
                  </button>
                )}
                <button onClick={() => { setForm({ ...EMPTY, ...d, es_dueno_conductor: statuses[d.id] === "owner" }); setEditing(d.id); setOpen(true); }} className="text-primary hover:underline">Editar</button>
                <button onClick={() => remove(d.id)} aria-label="Eliminar chofer" className="text-destructive"><Trash2 className="h-4 w-4" /></button>
              </div>
            </div>
          ))}
      </div>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-xl rounded-xl bg-card p-6 shadow-xl">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-xl font-bold">{editing ? "Editar chofer" : "Nuevo chofer"}</h2>
              <button onClick={() => setOpen(false)} aria-label="Cerrar"><X className="h-5 w-5" /></button>
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              <Field label="Nombre completo" value={form.nombre_completo} onChange={(v) => setForm({ ...form, nombre_completo: v })} />
              <Field label="RUT" value={form.rut} onChange={(v) => setForm({ ...form, rut: v })} />
              <Field label="Correo (para invitación)" type="email" value={form.email} onChange={(v) => setForm({ ...form, email: v })} />
              <Field label="Celular" value={form.celular} onChange={(v) => setForm({ ...form, celular: v })} />
              <div>
                <label className="block text-sm font-medium">Clase licencia</label>
                <select value={form.clase_licencia} onChange={(e) => setForm({ ...form, clase_licencia: e.target.value })}
                  className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
                  {CLASES_LICENCIA.map((c) => <option key={c}>{c}</option>)}
                </select>
              </div>
              <Field label="Vencimiento licencia" type="date" value={form.licencia_vencimiento} onChange={(v) => setForm({ ...form, licencia_vencimiento: v })} />
              <Field label="Vencimiento carnet identidad" type="date" value={form.carnet_vencimiento} onChange={(v) => setForm({ ...form, carnet_vencimiento: v })} />
              <div className="md:col-span-2">
                <label className="block text-sm font-medium">Foto (opcional)</label>
                <input type="file" accept=".jpg,.jpeg,.png,image/jpeg,image/png"
                  onChange={(e) => e.target.files?.[0] && uploadPhoto(e.target.files[0])}
                  className="mt-1 block text-sm" />
                {form.foto_url && <p className="mt-1 text-xs text-success">✓ Foto cargada</p>}
              </div>
              {(!editing || statuses[editing] !== "active") && (
                <label className="md:col-span-2 mt-1 flex items-start gap-2 rounded-md border border-primary/30 bg-primary-soft/40 p-3 text-sm">
                  <input type="checkbox" className="mt-0.5" checked={!!form.es_dueno_conductor}
                    onChange={(e) => setForm({ ...form, es_dueno_conductor: e.target.checked })} />
                  <span>
                    <span className="font-medium">Soy yo mismo el chofer de este camión (dueño-conductor)</span>
                    <span className="block text-xs text-muted-foreground">Se vinculará tu cuenta al chofer automáticamente. Igualmente deberás cargar licencia y cédula para validación.</span>
                  </span>
                </label>
              )}
            </div>
            <div className="mt-6 flex justify-end gap-2">
              <button onClick={() => setOpen(false)} className="rounded-md border px-4 py-2 text-sm">Cancelar</button>
              <button onClick={save} className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary-dark">Guardar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Field({ label, value, onChange, type = "text" }: { label: string; value: any; onChange: (v: string) => void; type?: string }) {
  return (
    <div>
      <label className="block text-sm font-medium">{label}</label>
      <input type={type} value={value ?? ""} onChange={(e) => onChange(e.target.value)}
        className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" />
    </div>
  );
}

function AccountBadge({ status }: { status: InvStatus }) {
  if (status === "owner")
    return <span className="rounded-full bg-primary/15 px-2 py-0.5 text-xs font-medium text-primary">Dueño-conductor</span>;
  if (status === "active")
    return <span className="rounded-full bg-success/15 px-2 py-0.5 text-xs font-medium text-success">Cuenta activa</span>;
  if (status === "pending")
    return <span className="rounded-full bg-primary-soft px-2 py-0.5 text-xs font-medium text-primary">Invitación pendiente</span>;
  if (status === "expired")
    return <span className="rounded-full bg-destructive/15 px-2 py-0.5 text-xs font-medium text-destructive">Invitación expirada</span>;
  return null;
}
