import { createFileRoute, Link } from "@tanstack/react-router";
import { pageHead } from "@/lib/page-head";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Truck, CheckCircle2, Clock, XCircle, Search, Upload, FileText, IdCard, Camera, Lock } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { listSuppliersForChofer } from "@/lib/chofer.functions";
import { validateUpload, ALLOWED_UPLOAD_ACCEPT } from "@/lib/upload-validation";

export const Route = createFileRoute("/_app/chofer")({
  head: () => pageHead("/chofer", "Portal del chofer · TN Chile", "Consulta el estado de tu inscripción como chofer TN Chile, sube documentos y accede a tus viajes y disponibilidad."),
  beforeLoad: async () => {
    const { redirect } = await import("@tanstack/react-router");
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw redirect({ to: "/login" });
    const { data: roles } = await supabase
      .from("user_roles").select("role").eq("user_id", user.id);
    const isChofer = (roles ?? []).some((r: any) => r.role === "chofer");
    const isAdmin = (roles ?? []).some((r: any) => r.role === "admin");
    if (!isChofer && !isAdmin) throw redirect({ to: "/dashboard" });
  },
  component: ChoferHome,
});

type DocTipo = "licencia_conducir" | "cedula_identidad" | "foto_perfil";

const DOC_LABELS: Record<DocTipo, { label: string; icon: any }> = {
  licencia_conducir: { label: "Licencia de conducir", icon: FileText },
  cedula_identidad: { label: "Cédula de identidad", icon: IdCard },
  foto_perfil: { label: "Foto de perfil", icon: Camera },
};

function ChoferHome() {
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUserId(data.user?.id ?? null));
  }, []);

  const perfilQuery = useQuery({
    enabled: !!userId,
    queryKey: ["chofer-perfil", userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("chofer_perfiles")
        .select("*")
        .eq("user_id", userId!)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  if (!userId || perfilQuery.isLoading) {
    return <div className="text-center text-muted-foreground">Cargando…</div>;
  }

  if (!perfilQuery.data) {
    return <InscripcionForm userId={userId} onCreated={() => perfilQuery.refetch()} />;
  }

  return <EstadoView userId={userId} perfil={perfilQuery.data} onUpdated={() => perfilQuery.refetch()} />;
}

function InscripcionForm({ userId, onCreated }: { userId: string; onCreated: () => void }) {
  const listSuppliers = useServerFn(listSuppliersForChofer);
  const suppliersQuery = useQuery({
    queryKey: ["suppliers-for-chofer"],
    queryFn: () => listSuppliers(),
  });

  const [nombre, setNombre] = useState("");
  const [rut, setRut] = useState("");
  const [licencia, setLicencia] = useState("");
  const [proveedorId, setProveedorId] = useState("");
  const [proveedorSearch, setProveedorSearch] = useState("");
  const [licenciaFile, setLicenciaFile] = useState<File | null>(null);
  const [cedulaFile, setCedulaFile] = useState<File | null>(null);
  const [fotoFile, setFotoFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);

  const suppliers = (suppliersQuery.data ?? []) as { id: string; razon_social: string | null }[];
  const filtered = suppliers.filter((s) =>
    (s.razon_social ?? "").toLowerCase().includes(proveedorSearch.toLowerCase())
  );

  const uploadDoc = async (tipo: DocTipo, file: File) => {
    const check = validateUpload(file);
    if (!check.ok) throw new Error(check.error);
    const ext = file.name.split(".").pop();
    const path = `${userId}/${tipo}-${Date.now()}.${ext}`;
    const { error: upErr } = await supabase.storage.from("driver-photos").upload(path, file);
    if (upErr) throw upErr;
    const { error: insErr } = await supabase.from("documentos_chofer").insert({
      user_id: userId, tipo, storage_path: path, file_name: file.name,
    });
    if (insErr) throw insErr;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nombre || !rut || !licencia || !proveedorId) {
      toast.error("Completa todos los campos.");
      return;
    }
    if (!licenciaFile || !cedulaFile || !fotoFile) {
      toast.error("Sube los 3 documentos requeridos.");
      return;
    }
    setSaving(true);
    try {
      const { error: perfilErr } = await supabase.from("chofer_perfiles").insert({
        user_id: userId,
        nombre, rut, licencia_numero: licencia,
        proveedor_id: proveedorId,
        estado_validacion: "pendiente",
      });
      if (perfilErr) throw perfilErr;
      await uploadDoc("licencia_conducir", licenciaFile);
      await uploadDoc("cedula_identidad", cedulaFile);
      await uploadDoc("foto_perfil", fotoFile);
      toast.success("Inscripción enviada. Queda pendiente de validación.");
      onCreated();
    } catch (err: any) {
      toast.error(err?.message ?? "No se pudo enviar la inscripción");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="text-center">
        <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-primary-soft">
          <Truck className="h-7 w-7 text-primary" />
        </div>
        <h1 className="text-2xl font-bold text-primary-dark">Inscripción de chofer</h1>
        <p className="text-sm text-muted-foreground">
          Completa tus datos y sube tus documentos. Un administrador validará tu inscripción.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5 rounded-xl border bg-card p-6 shadow-sm">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <Field label="Nombre completo">
            <input value={nombre} onChange={(e) => setNombre(e.target.value)} required className={inputCls} />
          </Field>
          <Field label="RUT">
            <input value={rut} onChange={(e) => setRut(e.target.value)} required placeholder="12.345.678-9" className={inputCls} />
          </Field>
          <Field label="Número de licencia">
            <input value={licencia} onChange={(e) => setLicencia(e.target.value)} required className={inputCls} />
          </Field>
          <Field label="Proveedor al que perteneces">
            <div className="relative">
              <Search className="pointer-events-none absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <input
                value={proveedorSearch}
                onChange={(e) => setProveedorSearch(e.target.value)}
                placeholder="Buscar proveedor…"
                className={inputCls + " pl-8"}
              />
            </div>
            <select
              value={proveedorId}
              onChange={(e) => setProveedorId(e.target.value)}
              required
              className={inputCls + " mt-2"}
            >
              <option value="">— Selecciona un proveedor —</option>
              {filtered.map((s) => (
                <option key={s.id} value={s.id}>{s.razon_social ?? s.id.slice(0, 8)}</option>
              ))}
            </select>
            {suppliersQuery.isLoading && <p className="mt-1 text-xs text-muted-foreground">Cargando proveedores…</p>}
          </Field>
        </div>

        <div className="space-y-3 border-t pt-4">
          <h2 className="font-semibold text-primary-dark">Documentos requeridos</h2>
          <FileField label="Licencia de conducir" file={licenciaFile} onChange={setLicenciaFile} icon={FileText} />
          <FileField label="Cédula de identidad" file={cedulaFile} onChange={setCedulaFile} icon={IdCard} />
          <FileField label="Foto de perfil" file={fotoFile} onChange={setFotoFile} icon={Camera} />
          <p className="text-xs text-muted-foreground">PDF o imágenes (JPG/PNG), máx. 10 MB cada uno.</p>
        </div>

        <button
          type="submit"
          disabled={saving}
          className="w-full rounded-md bg-primary px-4 py-2 font-medium text-primary-foreground hover:bg-primary-dark disabled:opacity-50"
        >
          {saving ? "Enviando…" : "Enviar inscripción"}
        </button>
      </form>
    </div>
  );
}

function EstadoView({ userId, perfil, onUpdated }: { userId: string; perfil: any; onUpdated: () => void }) {
  const qc = useQueryClient();
  const docsQuery = useQuery({
    queryKey: ["chofer-docs", userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("documentos_chofer")
        .select("*")
        .eq("user_id", userId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const estado = perfil.estado_validacion as "pendiente" | "en_revision" | "aprobado" | "rechazado";
  const puedeVerCargas = estado === "aprobado";

  const estadoUI: Record<typeof estado, { label: string; color: string; icon: any; desc: string }> = {
    pendiente: {
      label: "Pendiente",
      color: "bg-amber-100 text-amber-800 border-amber-300",
      icon: Clock,
      desc: "Recibimos tu inscripción. Está a la espera de revisión por un administrador.",
    },
    en_revision: {
      label: "En revisión",
      color: "bg-blue-100 text-blue-800 border-blue-300",
      icon: Search,
      desc: "Un administrador está revisando tus documentos.",
    },
    aprobado: {
      label: "Aprobado",
      color: "bg-emerald-100 text-emerald-800 border-emerald-300",
      icon: CheckCircle2,
      desc: "Tu inscripción fue aprobada. Ya puedes ver tus cargas asignadas.",
    },
    rechazado: {
      label: "Rechazado",
      color: "bg-red-100 text-red-800 border-red-300",
      icon: XCircle,
      desc: perfil.motivo_rechazo
        ? `Motivo: ${perfil.motivo_rechazo}`
        : "Contacta al administrador para más información.",
    },
  };
  const E = estadoUI[estado];

  const uploadReplace = async (tipo: DocTipo, file: File) => {
    const check = validateUpload(file);
    if (!check.ok) { toast.error(check.error); return; }
    const ext = file.name.split(".").pop();
    const path = `${userId}/${tipo}-${Date.now()}.${ext}`;
    const { error: upErr } = await supabase.storage.from("driver-photos").upload(path, file);
    if (upErr) { toast.error(upErr.message); return; }
    const { error: insErr } = await supabase.from("documentos_chofer").insert({
      user_id: userId, tipo, storage_path: path, file_name: file.name,
    });
    if (insErr) { toast.error(insErr.message); return; }
    toast.success("Documento agregado");
    qc.invalidateQueries({ queryKey: ["chofer-docs", userId] });
  };

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className={`rounded-xl border-2 p-6 ${E.color}`}>
        <div className="flex items-center gap-3">
          <E.icon className="h-8 w-8" />
          <div>
            <p className="text-xs uppercase tracking-wide opacity-70">Estado de validación</p>
            <h1 className="text-2xl font-bold">{E.label}</h1>
          </div>
        </div>
        <p className="mt-3 text-sm">{E.desc}</p>
      </div>

      <div className="rounded-xl border bg-card p-6 shadow-sm">
        <h2 className="mb-3 font-semibold text-primary-dark">Mis datos</h2>
        <dl className="grid grid-cols-1 gap-3 text-sm md:grid-cols-2">
          <Row label="Nombre" value={perfil.nombre} />
          <Row label="RUT" value={perfil.rut} />
          <Row label="Licencia" value={perfil.licencia_numero} />
          <Row label="Proveedor" value={perfil.proveedor_id ? perfil.proveedor_id.slice(0, 8) + "…" : "—"} />
        </dl>
      </div>

      <div className="rounded-xl border bg-card p-6 shadow-sm">
        <h2 className="mb-3 font-semibold text-primary-dark">Mis documentos</h2>
        <div className="space-y-3">
          {(["licencia_conducir", "cedula_identidad", "foto_perfil"] as DocTipo[]).map((tipo) => {
            const meta = DOC_LABELS[tipo];
            const docs = (docsQuery.data ?? []).filter((d: any) => d.tipo === tipo);
            const latest = docs[0];
            const editable = estado === "pendiente" || estado === "rechazado";
            return (
              <div key={tipo} className="flex flex-wrap items-center justify-between gap-3 rounded-md border p-3">
                <div className="flex items-center gap-2">
                  <meta.icon className="h-4 w-4 text-primary" />
                  <div>
                    <p className="text-sm font-medium">{meta.label}</p>
                    <p className="text-xs text-muted-foreground">
                      {latest ? latest.file_name ?? "Subido" : "No subido"}
                    </p>
                  </div>
                </div>
                {editable && (
                  <label className="cursor-pointer text-xs text-primary hover:underline">
                    <input
                      type="file"
                      className="hidden"
                      accept={ALLOWED_UPLOAD_ACCEPT}
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        if (f) uploadReplace(tipo, f);
                        e.target.value = "";
                      }}
                    />
                    <span className="inline-flex items-center gap-1"><Upload className="h-3 w-3" /> Reemplazar</span>
                  </label>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <div className="rounded-xl border bg-card p-6 shadow-sm">
        <h2 className="mb-2 font-semibold text-primary-dark">Cargas asignadas</h2>
        {puedeVerCargas ? (
          <Link
            to="/mis-viajes"
            className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary-dark"
          >
            <Truck className="h-4 w-4" /> Ver mis viajes
          </Link>
        ) : (
          <div className="flex items-center gap-2 rounded-md bg-muted p-4 text-sm text-muted-foreground">
            <Lock className="h-4 w-4" />
            Podrás ver tus cargas asignadas cuando tu inscripción sea aprobada.
          </div>
        )}
      </div>

    </div>
  );
}

const inputCls =
  "w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-1 block text-sm font-medium">{label}</label>
      {children}
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-wide text-muted-foreground">{label}</dt>
      <dd className="font-medium">{value ?? "—"}</dd>
    </div>
  );
}

function FileField({
  label, file, onChange, icon: Icon,
}: { label: string; file: File | null; onChange: (f: File | null) => void; icon: any }) {
  return (
    <label className="flex cursor-pointer items-center justify-between rounded-md border border-dashed p-3 hover:border-primary">
      <span className="flex items-center gap-2 text-sm">
        <Icon className="h-4 w-4 text-primary" />
        <span>{label}</span>
      </span>
      <span className="text-xs text-muted-foreground">
        {file ? file.name : "Elegir archivo"}
      </span>
      <input
        type="file"
        className="hidden"
        accept={ALLOWED_UPLOAD_ACCEPT}
        onChange={(e) => onChange(e.target.files?.[0] ?? null)}
      />
    </label>
  );
}
