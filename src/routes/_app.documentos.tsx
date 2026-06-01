import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { FileText, Trash2, Upload, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { StatusBadge } from "@/components/StatusBadge";
import { ALLOWED_UPLOAD_ACCEPT, validateUpload } from "@/lib/upload-validation";

export const Route = createFileRoute("/_app/documentos")({
  component: DocumentosPage,
});

const TIPOS = [
  "SOAP",
  "Permiso de circulación",
  "Revisión técnica",
  "Póliza de seguro",
  "Licencia chofer",
  "Otro",
];

function DocumentosPage() {
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [tipo, setTipo] = useState(TIPOS[0]);
  const [nombre, setNombre] = useState("");
  const [vencimiento, setVencimiento] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [userId, setUserId] = useState("");

  const load = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) setUserId(user.id);
    const { data } = await supabase.from("documents").select("*").is("deleted_at", null).order("created_at", { ascending: false });
    setItems(data ?? []);
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const upload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) return toast.error("Selecciona un archivo");
    const v = validateUpload(file);
    if (!v.ok) return toast.error(v.error);
    setUploading(true);
    const path = `${userId}/${Date.now()}-${file.name}`;
    const { error: upErr } = await supabase.storage.from("documents").upload(path, file);
    if (upErr) { setUploading(false); return toast.error(upErr.message); }
    const { error } = await supabase.from("documents").insert({
      user_id: userId, tipo, nombre: nombre || file.name,
      file_url: path, vencimiento: vencimiento || null,
    });
    setUploading(false);
    if (error) toast.error(error.message);
    else {
      toast.success("Documento subido");
      setFile(null); setNombre(""); setVencimiento("");
      load();
    }
  };

  const view = async (path: string) => {
    const { data } = await supabase.storage.from("documents").createSignedUrl(path, 3600);
    if (data?.signedUrl) window.open(data.signedUrl, "_blank");
  };

  const remove = async (id: string, _path: string) => {
    if (!confirm("¿Eliminar documento?")) return;
    // Soft delete — preserve file in storage for audit/recovery
    const { error } = await supabase.from("documents").update({ deleted_at: new Date().toISOString() }).eq("id", id);
    if (error) toast.error(error.message);
    else { toast.success("Eliminado"); load(); }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Documentos</h1>
        <p className="text-muted-foreground">Sube y administra tu documentación (PDF e imágenes).</p>
      </div>

      <form onSubmit={upload} className="rounded-xl border bg-card p-6 shadow-sm">
        <h2 className="mb-4 font-semibold">Subir nuevo documento</h2>
        <div className="grid gap-3 md:grid-cols-4">
          <div>
            <label className="block text-sm font-medium">Tipo</label>
            <select value={tipo} onChange={(e) => setTipo(e.target.value)}
              className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
              {TIPOS.map((t) => <option key={t}>{t}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium">Nombre (opcional)</label>
            <input value={nombre} onChange={(e) => setNombre(e.target.value)}
              className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="block text-sm font-medium">Vencimiento</label>
            <input type="date" value={vencimiento} onChange={(e) => setVencimiento(e.target.value)}
              className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="block text-sm font-medium">Archivo</label>
            <input type="file" accept={ALLOWED_UPLOAD_ACCEPT} onChange={(e) => {
                const f = e.target.files?.[0] ?? null;
                if (f) {
                  const v = validateUpload(f);
                  if (!v.ok) { toast.error(v.error); e.target.value = ""; setFile(null); return; }
                }
                setFile(f);
              }}
              className="mt-1 block w-full text-sm" />
          </div>
        </div>
        <button disabled={uploading} className="mt-4 inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary-dark disabled:opacity-60">
          <Upload className="h-4 w-4" /> {uploading ? "Subiendo..." : "Subir documento"}
        </button>
      </form>

      <div className="rounded-xl border bg-card shadow-sm">
        <div className="border-b px-5 py-4">
          <h2 className="font-semibold">Mis documentos</h2>
        </div>
        {loading ? <p className="p-5 text-sm text-muted-foreground">Cargando...</p>
          : items.length === 0 ? <p className="p-5 text-sm text-muted-foreground">No has subido documentos.</p>
          : (
            <ul className="divide-y">
              {items.map((d) => (
                <li key={d.id} className="flex items-center justify-between gap-3 px-5 py-3">
                  <div className="flex items-center gap-3">
                    <FileText className="h-5 w-5 text-primary" />
                    <div>
                      <p className="font-medium">{d.nombre}</p>
                      <p className="text-xs text-muted-foreground">{d.tipo}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    {d.vencimiento && <StatusBadge fecha={d.vencimiento} />}
                    <button onClick={() => view(d.file_url)} className="text-primary hover:underline" title="Ver">
                      <ExternalLink className="h-4 w-4" />
                    </button>
                    <button onClick={() => remove(d.id, d.file_url)} className="text-destructive"><Trash2 className="h-4 w-4" /></button>
                  </div>
                </li>
              ))}
            </ul>
          )}
      </div>
    </div>
  );
}
