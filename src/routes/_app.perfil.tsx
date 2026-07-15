import { createFileRoute } from "@tanstack/react-router";
import { pageHead } from "@/lib/page-head";
import { useEffect, useState } from "react";
import { Plus, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { ALLOWED_UPLOAD_ACCEPT, validateUpload } from "@/lib/upload-validation";
import { REGIONES_CHILE } from "@/lib/regions";
import { StatusBadge } from "@/components/StatusBadge";

export const Route = createFileRoute("/_app/perfil")({
  head: () => pageHead("/perfil", "Perfil de la empresa · Portal Proveedores TN Chile", "Actualiza los datos de tu empresa proveedora en TN Chile: razón social, RUT, contacto, pólizas de seguro y completitud del perfil."),
  component: PerfilPage,
});

const EMPTY_POLIZA = {
  numero_poliza: "",
  aseguradora: "",
  tipo_cobertura: "",
  monto: "",
  fecha_inicio: "",
  fecha_vencimiento: "",
  archivo_url: "",
  activa: true,
};

function PerfilPage() {
  const [form, setForm] = useState<any>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [userId, setUserId] = useState<string>("");
  const [polizas, setPolizas] = useState<any[]>([]);
  const [polizaOpen, setPolizaOpen] = useState(false);
  const [polizaForm, setPolizaForm] = useState<any>(EMPTY_POLIZA);
  const [polizaEditing, setPolizaEditing] = useState<string | null>(null);

  const loadPolizas = async (uid: string) => {
    const { data } = await (supabase as any)
      .from("polizas")
      .select("*")
      .eq("proveedor_id", uid)
      .is("deleted_at", null)
      .order("created_at", { ascending: false });
    setPolizas(data ?? []);
  };

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      setUserId(user.id);
      const { data } = await supabase.from("profiles").select("*").eq("id", user.id).maybeSingle();
      if (data) setForm(data);
      await loadPolizas(user.id);
      setLoading(false);
    })();
  }, []);

  const update = (k: string, v: any) => setForm((f: any) => ({ ...f, [k]: v }));

  const uploadFile = async (file: File, field: string, target: "profile" | "poliza") => {
    const v = validateUpload(file);
    if (!v.ok) return toast.error(v.error);
    const path = `${userId}/${field}-${Date.now()}-${file.name}`;
    const { error } = await supabase.storage.from("documents").upload(path, file);
    if (error) return toast.error(error.message);
    if (target === "profile") update(field, path);
    else setPolizaForm((p: any) => ({ ...p, archivo_url: path }));
    toast.success("Archivo subido");
  };

  const viewFile = async (path: string) => {
    const { data } = await supabase.storage.from("documents").createSignedUrl(path, 3600);
    if (data?.signedUrl) window.open(data.signedUrl, "_blank");
    else toast.error("No se pudo abrir el archivo");
  };

  const save = async () => {
    setSaving(true);
    const { error } = await supabase.from("profiles").upsert({ ...form, id: userId, updated_at: new Date().toISOString() });
    setSaving(false);
    if (error) toast.error(error.message);
    else toast.success("Perfil guardado");
  };

  const savePoliza = async () => {
    const numero = (polizaForm.numero_poliza ?? "").trim();
    if (!numero) return toast.error("El número de póliza es obligatorio");

    const fi = polizaForm.fecha_inicio || null;
    const fv = polizaForm.fecha_vencimiento || null;
    if (fi && fv && new Date(fv) <= new Date(fi)) {
      return toast.error("La fecha de vencimiento debe ser posterior a la fecha de inicio");
    }

    const duplicado = polizas.some(
      (p) =>
        p.id !== polizaEditing &&
        (p.numero_poliza ?? "").trim().toLowerCase() === numero.toLowerCase(),
    );
    if (duplicado) return toast.error("Ya existe una póliza con ese número");

    const payload: any = {
      ...polizaForm,
      numero_poliza: numero,
      proveedor_id: userId,
      monto: polizaForm.monto === "" || polizaForm.monto == null ? null : Number(polizaForm.monto),
      fecha_inicio: fi,
      fecha_vencimiento: fv,
    };
    const res = polizaEditing
      ? await (supabase as any).from("polizas").update(payload).eq("id", polizaEditing)
      : await (supabase as any).from("polizas").insert(payload);
    if (res.error) return toast.error(res.error.message);
    toast.success(polizaEditing ? "Póliza actualizada" : "Póliza agregada");
    setPolizaOpen(false);
    setPolizaForm(EMPTY_POLIZA);
    setPolizaEditing(null);
    await loadPolizas(userId);
  };

  const removePoliza = async (id: string) => {
    if (!confirm("¿Eliminar esta póliza?")) return;
    const { error } = await (supabase as any)
      .from("polizas")
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", id);
    if (error) toast.error(error.message);
    else { toast.success("Eliminada"); loadPolizas(userId); }
  };

  if (loading) return <p className="text-muted-foreground">Cargando...</p>;

  const fields: [string, string, string?][] = [
    ["razon_social", "Razón social"],
    ["rut_empresa", "RUT empresa"],
    ["nombre_contacto", "Nombre contacto"],
    ["cargo", "Cargo"],
    ["correo", "Correo", "email"],
    ["telefono", "Teléfono"],
    ["direccion", "Dirección"],
  ];

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Perfil del Proveedor</h1>
        <p className="text-muted-foreground">Datos de la empresa y documentación.</p>
      </div>

      <div className="rounded-xl border bg-card p-6 shadow-sm">
        <h2 className="mb-4 font-semibold">Información de la empresa</h2>
        <div className="grid gap-4 md:grid-cols-2">
          {fields.map(([k, label, type]) => (
            <div key={k}>
              <label className="block text-sm font-medium">{label}</label>
              <input type={type ?? "text"} value={form[k] ?? ""} onChange={(e) => update(k, e.target.value)}
                className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" />
            </div>
          ))}
          <div>
            <label className="block text-sm font-medium">Región</label>
            <select value={form.region ?? ""} onChange={(e) => update("region", e.target.value)}
              className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
              <option value="">Seleccionar...</option>
              {REGIONES_CHILE.map((r) => <option key={r} value={r}>{r}</option>)}
            </select>
          </div>
        </div>
      </div>

      <div className="rounded-xl border bg-card p-6 shadow-sm">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h2 className="font-semibold">Pólizas de seguro</h2>
            <p className="text-sm text-muted-foreground">Gestiona una o más pólizas vigentes.</p>
          </div>
          <button
            onClick={() => { setPolizaForm(EMPTY_POLIZA); setPolizaEditing(null); setPolizaOpen(true); }}
            className="flex items-center gap-2 rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:bg-primary-dark">
            <Plus className="h-4 w-4" /> Nueva póliza
          </button>
        </div>
        {polizas.length === 0 ? (
          <p className="text-sm text-muted-foreground">Aún no hay pólizas registradas.</p>
        ) : (
          <ul className="divide-y">
            {polizas.map((p) => (
              <li key={p.id} className="flex items-start justify-between gap-3 py-3">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-medium">{p.numero_poliza || "(sin número)"}</p>
                    {!p.activa && (
                      <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">Inactiva</span>
                    )}
                    <StatusBadge fecha={p.fecha_vencimiento} label="Vence" />
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {p.aseguradora || "—"}{p.tipo_cobertura ? ` · ${p.tipo_cobertura}` : ""}
                    {p.monto != null ? ` · $${Number(p.monto).toLocaleString("es-CL")}` : ""}
                  </p>
                  {p.archivo_url && (
                    <button onClick={() => viewFile(p.archivo_url)} className="mt-1 text-xs text-primary underline">
                      Ver archivo
                    </button>
                  )}
                </div>
                <div className="flex shrink-0 gap-3 text-sm">
                  <button
                    onClick={() => {
                      setPolizaForm({ ...EMPTY_POLIZA, ...p, monto: p.monto ?? "" });
                      setPolizaEditing(p.id);
                      setPolizaOpen(true);
                    }}
                    className="text-primary hover:underline">Editar</button>
                  <button onClick={() => removePoliza(p.id)} className="text-destructive">
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="rounded-xl border bg-card p-6 shadow-sm">
        <h2 className="mb-4 font-semibold">Otros documentos</h2>
        <div>
          <label className="block text-sm font-medium">Certificado SII (PDF / imagen)</label>
          <input type="file" accept={ALLOWED_UPLOAD_ACCEPT}
            onChange={(e) => e.target.files?.[0] && uploadFile(e.target.files[0], "certificado_sii_url", "profile")}
            className="mt-1 block text-sm" />
          {form.certificado_sii_url && (
            <p className="mt-1 text-xs text-success">
              ✓ Cargado · <button type="button" onClick={() => viewFile(form.certificado_sii_url)} className="underline">Ver</button>
            </p>
          )}
        </div>
      </div>

      <button onClick={save} disabled={saving}
        className="rounded-md bg-primary px-6 py-2 font-medium text-primary-foreground hover:bg-primary-dark disabled:opacity-60">
        {saving ? "Guardando..." : "Guardar cambios"}
      </button>

      {polizaOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-xl rounded-xl bg-card p-6 shadow-xl">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-xl font-bold">{polizaEditing ? "Editar póliza" : "Nueva póliza"}</h2>
              <button onClick={() => setPolizaOpen(false)}><X className="h-5 w-5" /></button>
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              <PField label="Número de póliza" value={polizaForm.numero_poliza}
                onChange={(v) => setPolizaForm({ ...polizaForm, numero_poliza: v })} />
              <PField label="Aseguradora" value={polizaForm.aseguradora}
                onChange={(v) => setPolizaForm({ ...polizaForm, aseguradora: v })} />
              <PField label="Tipo de cobertura" value={polizaForm.tipo_cobertura}
                onChange={(v) => setPolizaForm({ ...polizaForm, tipo_cobertura: v })} />
              <PField label="Monto asegurado (CLP)" type="number" value={polizaForm.monto}
                onChange={(v) => setPolizaForm({ ...polizaForm, monto: v })} />
              <PField label="Fecha inicio" type="date" value={polizaForm.fecha_inicio}
                onChange={(v) => setPolizaForm({ ...polizaForm, fecha_inicio: v })} />
              <PField label="Fecha vencimiento" type="date" value={polizaForm.fecha_vencimiento}
                onChange={(v) => setPolizaForm({ ...polizaForm, fecha_vencimiento: v })} />
              <div className="md:col-span-2">
                <label className="block text-sm font-medium">Archivo de póliza (PDF / imagen)</label>
                <input type="file" accept={ALLOWED_UPLOAD_ACCEPT}
                  onChange={(e) => e.target.files?.[0] && uploadFile(e.target.files[0], "poliza", "poliza")}
                  className="mt-1 block text-sm" />
                {polizaForm.archivo_url && (
                  <p className="mt-1 text-xs text-success">
                    ✓ Cargado · <button type="button" onClick={() => viewFile(polizaForm.archivo_url)} className="underline">Ver</button>
                  </p>
                )}
              </div>
              <label className="flex items-center gap-2 text-sm md:col-span-2">
                <input type="checkbox" checked={!!polizaForm.activa}
                  onChange={(e) => setPolizaForm({ ...polizaForm, activa: e.target.checked })} />
                Póliza activa
              </label>
            </div>
            <div className="mt-6 flex justify-end gap-2">
              <button onClick={() => setPolizaOpen(false)} className="rounded-md border px-4 py-2 text-sm">Cancelar</button>
              <button onClick={savePoliza}
                className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary-dark">
                Guardar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function PField({ label, value, onChange, type = "text" }: { label: string; value: any; onChange: (v: string) => void; type?: string }) {
  return (
    <div>
      <label className="block text-sm font-medium">{label}</label>
      <input type={type} value={value ?? ""} onChange={(e) => onChange(e.target.value)}
        className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" />
    </div>
  );
}
