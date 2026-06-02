import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { FileText, Trash2, Upload, ExternalLink, History, ChevronDown, ChevronRight } from "lucide-react";
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

type Doc = {
  id: string;
  tipo: string;
  nombre: string | null;
  file_url: string;
  vencimiento: string | null;
  related_id: string | null;
  is_current: boolean;
  version_number: number;
  previous_version_id: string | null;
  created_at: string;
};

function DocumentosPage() {
  const [items, setItems] = useState<Doc[]>([]);
  const [history, setHistory] = useState<Doc[]>([]);
  const [loading, setLoading] = useState(true);
  const [tipo, setTipo] = useState(TIPOS[0]);
  const [nombre, setNombre] = useState("");
  const [vencimiento, setVencimiento] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [userId, setUserId] = useState("");
  const [openHistory, setOpenHistory] = useState<Record<string, boolean>>({});

  const load = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) setUserId(user.id);
    const { data } = await supabase.from("documents").select("*")
      .is("deleted_at", null)
      .order("created_at", { ascending: false });
    const all = (data ?? []) as Doc[];
    setItems(all.filter((d) => d.is_current !== false));
    setHistory(all.filter((d) => d.is_current === false));
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

    // Find existing current version (same user + tipo, no related_id linkage here)
    const { data: prev } = await supabase
      .from("documents")
      .select("id, version_number")
      .eq("user_id", userId)
      .eq("tipo", tipo)
      .is("deleted_at", null)
      .eq("is_current", true)
      .order("version_number", { ascending: false })
      .limit(1);
    const prevRow = (prev ?? [])[0] as { id: string; version_number: number } | undefined;

    if (prevRow) {
      await supabase.from("documents").update({ is_current: false }).eq("id", prevRow.id);
    }

    const { error } = await supabase.from("documents").insert({
      user_id: userId,
      tipo,
      nombre: nombre || file.name,
      file_url: path,
      vencimiento: vencimiento || null,
      is_current: true,
      version_number: (prevRow?.version_number ?? 0) + 1,
      previous_version_id: prevRow?.id ?? null,
    });
    setUploading(false);
    if (error) toast.error(error.message);
    else {
      toast.success(prevRow ? "Nueva versión cargada" : "Documento subido");
      setFile(null); setNombre(""); setVencimiento("");
      load();
    }
  };

  const view = async (path: string) => {
    const { data } = await supabase.storage.from("documents").createSignedUrl(path, 3600);
    if (data?.signedUrl) window.open(data.signedUrl, "_blank");
  };

  const remove = async (id: string) => {
    if (!confirm("¿Eliminar documento?")) return;
    const { error } = await supabase.from("documents").update({ deleted_at: new Date().toISOString() }).eq("id", id);
    if (error) toast.error(error.message);
    else { toast.success("Eliminado"); load(); }
  };

  // Build the history chain for a current doc by walking previous_version_id
  const historyFor = (current: Doc): Doc[] => {
    const byId = new Map(history.map((h) => [h.id, h]));
    const chain: Doc[] = [];
    let cursor = current.previous_version_id;
    while (cursor) {
      const node = byId.get(cursor);
      if (!node) break;
      chain.push(node);
      cursor = node.previous_version_id;
    }
    return chain;
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Documentos</h1>
        <p className="text-muted-foreground">Sube y administra tu documentación (PDF e imágenes). Al subir un documento del mismo tipo se conserva el historial.</p>
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
          <h2 className="font-semibold">Mis documentos vigentes</h2>
        </div>
        {loading ? <p className="p-5 text-sm text-muted-foreground">Cargando...</p>
          : items.length === 0 ? <p className="p-5 text-sm text-muted-foreground">No has subido documentos.</p>
          : (
            <ul className="divide-y">
              {items.map((d) => {
                const prevs = historyFor(d);
                const open = !!openHistory[d.id];
                return (
                  <li key={d.id} className="px-5 py-3">
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <FileText className="h-5 w-5 text-primary" />
                        <div>
                          <p className="font-medium">
                            {d.nombre}
                            {d.version_number > 1 && (
                              <span className="ml-2 rounded-full bg-primary-soft px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-primary-dark">v{d.version_number}</span>
                            )}
                          </p>
                          <p className="text-xs text-muted-foreground">{d.tipo}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        {d.vencimiento && <StatusBadge fecha={d.vencimiento} />}
                        <button onClick={() => view(d.file_url)} className="text-primary hover:underline" title="Ver">
                          <ExternalLink className="h-4 w-4" />
                        </button>
                        <button onClick={() => remove(d.id)} className="text-destructive"><Trash2 className="h-4 w-4" /></button>
                      </div>
                    </div>
                    {prevs.length > 0 && (
                      <div className="mt-2 pl-8">
                        <button
                          type="button"
                          onClick={() => setOpenHistory((s) => ({ ...s, [d.id]: !open }))}
                          className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
                        >
                          {open ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
                          <History className="h-3 w-3" /> Ver historial ({prevs.length})
                        </button>
                        {open && (
                          <ul className="mt-2 space-y-1 border-l-2 border-muted pl-3">
                            {prevs.map((h) => (
                              <li key={h.id} className="flex items-center justify-between text-xs text-muted-foreground">
                                <span>
                                  <span className="mr-2 rounded bg-muted px-1.5 py-0.5 font-mono">v{h.version_number}</span>
                                  Subido {new Date(h.created_at).toLocaleDateString("es-CL")}
                                  {h.vencimiento && <span className="ml-2">· vence {h.vencimiento}</span>}
                                </span>
                                <button onClick={() => view(h.file_url)} className="text-primary hover:underline">
                                  <ExternalLink className="h-3 w-3" />
                                </button>
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
      </div>
    </div>
  );
}
