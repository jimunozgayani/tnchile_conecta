import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { ALLOWED_UPLOAD_ACCEPT, validateUpload } from "@/lib/upload-validation";
import { REGIONES_CHILE } from "@/lib/regions";

export const Route = createFileRoute("/_app/perfil")({
  component: PerfilPage,
});

function PerfilPage() {
  const [form, setForm] = useState<any>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [userId, setUserId] = useState<string>("");

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      setUserId(user.id);
      const { data } = await supabase.from("profiles").select("*").eq("id", user.id).maybeSingle();
      if (data) setForm(data);
      setLoading(false);
    })();
  }, []);

  const update = (k: string, v: any) => setForm((f: any) => ({ ...f, [k]: v }));

  const uploadFile = async (file: File, field: string) => {
    const v = validateUpload(file);
    if (!v.ok) return toast.error(v.error);
    const path = `${userId}/${field}-${Date.now()}-${file.name}`;
    const { error } = await supabase.storage.from("documents").upload(path, file);
    if (error) return toast.error(error.message);
    update(field, path);
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
        <h2 className="mb-4 font-semibold">Documentos</h2>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium">Póliza de seguro (PDF)</label>
            <input type="file" accept="application/pdf"
              onChange={(e) => e.target.files?.[0] && uploadFile(e.target.files[0], "poliza_seguro_url")}
              className="mt-1 block text-sm" />
            {form.poliza_seguro_url && <p className="mt-1 text-xs text-success">✓ Cargado</p>}
            <label className="mt-2 block text-sm font-medium">Vencimiento póliza</label>
            <input type="date" value={form.poliza_seguro_vencimiento ?? ""}
              onChange={(e) => update("poliza_seguro_vencimiento", e.target.value)}
              className="mt-1 rounded-md border border-input bg-background px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="block text-sm font-medium">Certificado SII (PDF)</label>
            <input type="file" accept="application/pdf"
              onChange={(e) => e.target.files?.[0] && uploadFile(e.target.files[0], "certificado_sii_url")}
              className="mt-1 block text-sm" />
            {form.certificado_sii_url && <p className="mt-1 text-xs text-success">✓ Cargado</p>}
          </div>
        </div>
      </div>

      <button onClick={save} disabled={saving}
        className="rounded-md bg-primary px-6 py-2 font-medium text-primary-foreground hover:bg-primary-dark disabled:opacity-60">
        {saving ? "Guardando..." : "Guardar cambios"}
      </button>
    </div>
  );
}
