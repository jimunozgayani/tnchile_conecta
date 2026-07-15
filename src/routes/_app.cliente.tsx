import { createFileRoute } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { useEffect, useState } from "react";
import { Building2, Plus, Trash2, Upload, X, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { validateUpload } from "@/lib/upload-validation";

export const Route = createFileRoute("/_app/cliente")({
  beforeLoad: async () => {
    const { redirect } = await import("@tanstack/react-router");
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw redirect({ to: "/login" });
    const { data: roles } = await supabase
      .from("user_roles").select("role").eq("user_id", user.id);
    const isCliente = (roles ?? []).some((r: any) => r.role === "cliente");
    const isAdmin = (roles ?? []).some((r: any) => r.role === "admin");
    if (!isCliente && !isAdmin) throw redirect({ to: "/dashboard" });
  },
  component: ClienteHome,
});

const ESTADO_LABEL: Record<string, string> = {
  pendiente: "Pendiente",
  en_revision: "En revisión",
  cotizada: "Cotizada",
  aceptada: "Aceptada",
  rechazada: "Rechazada",
  cancelada: "Cancelada",
};
const ESTADO_CLASS: Record<string, string> = {
  pendiente: "bg-amber-100 text-amber-800",
  en_revision: "bg-blue-100 text-blue-800",
  cotizada: "bg-emerald-100 text-emerald-800",
  aceptada: "bg-primary-soft text-primary-dark",
  rechazada: "bg-red-100 text-red-800",
  cancelada: "bg-zinc-200 text-zinc-700",
};

type Cot = any;

function ClienteHome() {
  const [userId, setUserId] = useState<string | null>(null);
  const [list, setList] = useState<Cot[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);

  const load = async (uid: string) => {
    setLoading(true);
    const { data } = await (supabase as any)
      .from("cotizaciones").select("*").eq("cliente_id", uid).order("created_at", { ascending: false });
    setList(data ?? []);
    setLoading(false);
  };

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      setUserId(user.id);
      await load(user.id);
    })();
  }, []);

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <header className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary-soft">
            <Building2 className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-primary-dark">Mi portal · Clientes</h1>
            <p className="text-sm text-muted-foreground">Solicita cotizaciones y sigue su estado.</p>
          </div>
        </div>
        <button
          onClick={() => setShowForm((v) => !v)}
          className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary-dark"
        >
          {showForm ? <X className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
          {showForm ? "Cerrar" : "Solicitar cotización"}
        </button>
      </header>

      {showForm && userId && (
        <CotizacionForm
          userId={userId}
          onCreated={async () => {
            setShowForm(false);
            await load(userId);
          }}
        />
      )}

      <section className="rounded-xl border bg-card p-4 shadow-sm">
        <h2 className="mb-3 text-lg font-semibold">Mis cotizaciones</h2>
        {loading ? (
          <p className="text-sm text-muted-foreground">Cargando...</p>
        ) : list.length === 0 ? (
          <p className="text-sm text-muted-foreground">Aún no has enviado cotizaciones.</p>
        ) : (
          <ul className="divide-y">
            {list.map((c) => {
              const destinos = Array.isArray(c.destinos) ? c.destinos : [];
              return (
                <li key={c.id} className="py-3">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-medium text-primary-dark">
                        {c.origen} → {destinos.join(" · ") || "—"}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(c.created_at).toLocaleString("es-CL")}
                        {c.tipo_camion ? ` · ${c.tipo_camion}` : ""}
                        {` · ${c.modalidad === "consolidado" ? "Consolidado" : "Camión completo"}`}
                        {c.fecha_despacho ? ` · Despacho ${c.fecha_despacho}` : ""}
                      </p>
                    </div>
                    <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${ESTADO_CLASS[c.estado] ?? "bg-muted"}`}>
                      {ESTADO_LABEL[c.estado] ?? c.estado}
                    </span>
                  </div>
                  {c.notas_admin && (
                    <p className="mt-2 rounded-md bg-muted px-3 py-2 text-sm">
                      <span className="font-medium">Operaciones:</span> {c.notas_admin}
                    </p>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}

function CotizacionForm({ userId, onCreated }: { userId: string; onCreated: () => void }) {
  const [nombre, setNombre] = useState("");
  const [telefono, setTelefono] = useState("");
  const [email, setEmail] = useState("");
  const [origen, setOrigen] = useState("");
  const [destinos, setDestinos] = useState<string[]>([""]);
  const [tipoCamion, setTipoCamion] = useState("");
  const [modalidad, setModalidad] = useState<"completo" | "consolidado">("completo");
  const [peso, setPeso] = useState("");
  const [largo, setLargo] = useState("");
  const [ancho, setAncho] = useState("");
  const [alto, setAlto] = useState("");
  const [fecha, setFecha] = useState("");
  const [fotos, setFotos] = useState<File[]>([]);
  const [saving, setSaving] = useState(false);

  const onFiles = (files: FileList | null) => {
    if (!files) return;
    const ok: File[] = [];
    for (const f of Array.from(files)) {
      const v = validateUpload(f);
      if (!v.ok) { toast.error(`${f.name}: ${v.error}`); continue; }
      ok.push(f);
    }
    setFotos((prev) => [...prev, ...ok]);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nombre.trim() || !origen.trim()) {
      toast.error("Completa nombre y origen");
      return;
    }
    const dests = destinos.map((d) => d.trim()).filter(Boolean);
    if (dests.length === 0) {
      toast.error("Agrega al menos un destino");
      return;
    }
    setSaving(true);
    try {
      // Upload photos first under {userId}/{ts}-{name}
      const uploaded: string[] = [];
      for (const f of fotos) {
        const path = `${userId}/${Date.now()}-${f.name.replace(/[^\w.\-]+/g, "_")}`;
        const { error } = await (supabase as any).storage.from("cotizacion-fotos").upload(path, f, { upsert: false });
        if (error) throw error;
        uploaded.push(path);
      }

      const { error } = await (supabase as any).from("cotizaciones").insert({
        cliente_id: userId,
        contacto_nombre: nombre.trim(),
        contacto_telefono: telefono.trim() || null,
        contacto_email: email.trim() || null,
        origen: origen.trim(),
        destinos: dests,
        tipo_camion: tipoCamion.trim() || null,
        modalidad,
        peso_kg: peso ? Number(peso) : null,
        largo_cm: largo ? Number(largo) : null,
        ancho_cm: ancho ? Number(ancho) : null,
        alto_cm: alto ? Number(alto) : null,
        fecha_despacho: fecha || null,
        fotos: uploaded,
        estado: "pendiente",
      });
      if (error) throw error;
      toast.success("Cotización enviada");
      onCreated();
    } catch (err: any) {
      toast.error(err.message || "Error al enviar");
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={submit} className="space-y-4 rounded-xl border bg-card p-5 shadow-sm">
      <h2 className="text-lg font-semibold text-primary-dark">Nueva solicitud de cotización</h2>

      <div className="grid gap-3 md:grid-cols-3">
        <Field label="Nombre empresa o persona *">
          <input className="input" value={nombre} onChange={(e) => setNombre(e.target.value)} required />
        </Field>
        <Field label="Teléfono">
          <input className="input" value={telefono} onChange={(e) => setTelefono(e.target.value)} />
        </Field>
        <Field label="Email">
          <input type="email" className="input" value={email} onChange={(e) => setEmail(e.target.value)} />
        </Field>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <Field label="Origen (dirección o ciudad) *">
          <input className="input" value={origen} onChange={(e) => setOrigen(e.target.value)} required />
        </Field>
        <Field label="Fecha estimada de despacho">
          <input type="date" className="input" value={fecha} onChange={(e) => setFecha(e.target.value)} />
        </Field>
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium">Destinos *</label>
        <div className="space-y-2">
          {destinos.map((d, i) => (
            <div key={i} className="flex gap-2">
              <input
                className="input flex-1"
                placeholder={`Destino ${i + 1}`}
                value={d}
                onChange={(e) => setDestinos((prev) => prev.map((x, j) => (j === i ? e.target.value : x)))}
              />
              {destinos.length > 1 && (
                <button
                  type="button"
                  onClick={() => setDestinos((prev) => prev.filter((_, j) => j !== i))}
                  className="rounded-md border px-2 text-muted-foreground hover:text-destructive"
                  aria-label="Quitar destino"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              )}
            </div>
          ))}
        </div>
        <button
          type="button"
          onClick={() => setDestinos((prev) => [...prev, ""])}
          className="mt-2 inline-flex items-center gap-1 text-sm text-primary hover:underline"
        >
          <Plus className="h-3.5 w-3.5" /> Agregar destino
        </button>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <Field label="Tipo de camión requerido">
          <input
            className="input"
            placeholder="rampla, semirampla, batea, 3/4..."
            value={tipoCamion}
            onChange={(e) => setTipoCamion(e.target.value)}
          />
        </Field>
        <Field label="Modalidad">
          <select className="input" value={modalidad} onChange={(e) => setModalidad(e.target.value as any)}>
            <option value="completo">Camión completo</option>
            <option value="consolidado">Consolidación (carga compartida)</option>
          </select>
        </Field>
      </div>

      <div className="grid gap-3 md:grid-cols-4">
        <Field label="Peso estimado (kg)">
          <input type="number" min={0} className="input" value={peso} onChange={(e) => setPeso(e.target.value)} />
        </Field>
        <Field label="Largo (cm)">
          <input type="number" min={0} className="input" value={largo} onChange={(e) => setLargo(e.target.value)} />
        </Field>
        <Field label="Ancho (cm)">
          <input type="number" min={0} className="input" value={ancho} onChange={(e) => setAncho(e.target.value)} />
        </Field>
        <Field label="Alto (cm)">
          <input type="number" min={0} className="input" value={alto} onChange={(e) => setAlto(e.target.value)} />
        </Field>
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium">Fotos de la carga</label>
        <label className="flex cursor-pointer items-center gap-2 rounded-md border border-dashed px-3 py-4 text-sm text-muted-foreground hover:bg-muted">
          <Upload className="h-4 w-4" />
          Subir fotos (jpg, png, pdf hasta 10MB)
          <input
            type="file"
            accept=".jpg,.jpeg,.png,.pdf,image/*"
            multiple
            className="hidden"
            onChange={(e) => onFiles(e.target.files)}
          />
        </label>
        {fotos.length > 0 && (
          <ul className="mt-2 space-y-1 text-sm">
            {fotos.map((f, i) => (
              <li key={i} className="flex items-center justify-between rounded-md bg-muted px-2 py-1">
                <span className="truncate">{f.name}</span>
                <button
                  type="button"
                  onClick={() => setFotos((prev) => prev.filter((_, j) => j !== i))}
                  className="text-muted-foreground hover:text-destructive"
                >
                  <X className="h-4 w-4" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="flex justify-end">
        <button
          type="submit"
          disabled={saving}
          className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary-dark disabled:opacity-50"
        >
          {saving && <Loader2 className="h-4 w-4 animate-spin" />}
          Enviar solicitud
        </button>
      </div>

      <style>{`.input { width:100%; border:1px solid hsl(var(--border)); border-radius:0.375rem; padding:0.5rem 0.75rem; font-size:0.875rem; background:hsl(var(--background)); }`}</style>
    </form>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block text-sm">
      <span className="mb-1 block font-medium">{label}</span>
      {children}
    </label>
  );
}
