import { createFileRoute, redirect } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { pageHead } from "@/lib/page-head";
import { supabase } from "@/integrations/supabase/client";
import { createContacto } from "@/lib/contactos.functions";
import { REGIONES_CHILE } from "@/lib/regions";
import { Users, Plus, X, ChevronDown, Search } from "lucide-react";

type Tipo = "cliente" | "proveedor" | "chofer";
const TIPOS: Tipo[] = ["cliente", "proveedor", "chofer"];
const TIPO_LABEL: Record<Tipo, string> = { cliente: "Cliente", proveedor: "Proveedor", chofer: "Chofer" };
const TIPO_CLASS: Record<Tipo, string> = {
  cliente: "bg-blue-100 text-blue-800 ring-blue-200",
  proveedor: "bg-emerald-100 text-emerald-800 ring-emerald-200",
  chofer: "bg-orange-100 text-orange-800 ring-orange-200",
};
const ETAPAS = ["lead", "contactado", "cotizado", "ganado", "perdido"] as const;
const ETAPA_LABEL: Record<string, string> = {
  lead: "Lead", contactado: "Contactado", cotizado: "Cotizado", ganado: "Ganado", perdido: "Perdido",
};
const TEMP_LABEL: Record<string, string> = { caliente: "Caliente", tibio: "Tibio", frio: "Frío" };
const TEMP_DOT: Record<string, string> = { caliente: "bg-red-500", tibio: "bg-yellow-400", frio: "bg-blue-500" };

/** Comercial + admin gestionan; operador solo lectura. */
async function guard() {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw redirect({ to: "/login" });
  const { data } = await supabase.from("user_roles").select("role").eq("user_id", user.id);
  const roles = (data ?? []).map((r: { role: string }) => r.role);
  if (!["admin", "lider_cuenta", "comercial", "operador"].some((r) => roles.includes(r))) {
    throw redirect({ to: "/dashboard" });
  }
}

export const Route = createFileRoute("/_app/comercial-contactos")({
  head: () =>
    pageHead(
      "/comercial-contactos",
      "Contactos · Comercial TN Chile",
      "Agenda unificada de clientes, proveedores y choferes del equipo comercial de TN Chile.",
    ),
  ssr: false,
  beforeLoad: guard,
  component: ComercialContactosPage,
});

function ComercialContactosPage() {
  const [tipos, setTipos] = useState<Tipo[]>([]);
  const [temp, setTemp] = useState("");
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);

  const rolesQuery = useQuery({
    queryKey: ["mis-roles-contactos"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return [] as string[];
      const { data } = await supabase.from("user_roles").select("role").eq("user_id", user.id);
      return (data ?? []).map((r: { role: string }) => r.role);
    },
  });
  const roles = rolesQuery.data ?? [];
  const readOnly = roles.includes("operador") && !["admin", "lider_cuenta", "comercial"].some((r) => roles.includes(r));

  const listQuery = useQuery({
    queryKey: ["contactos", tipos, temp, q],
    queryFn: async () => {
      let query = supabase
        .from("contactos")
        .select("*")
        .is("deleted_at", null)
        .order("created_at", { ascending: false })
        .limit(300);
      if (tipos.length > 0) query = query.overlaps("tipos", tipos);
      if (temp) query = query.eq("temperatura", temp);
      const term = q.trim();
      if (term) query = query.or(`nombre.ilike.%${term}%,empresa.ilike.%${term}%`);
      const { data, error } = await query;
      if (error) throw error;
      return data ?? [];
    },
  });

  const rows = listQuery.data ?? [];
  const hasFilters = tipos.length > 0 || !!temp || !!q.trim();
  const clearFilters = () => { setTipos([]); setTemp(""); setQ(""); };

  const toggleTipo = (t: Tipo) =>
    setTipos((prev) => (prev.includes(t) ? prev.filter((x) => x !== t) : [...prev, t]));

  return (
    <div className="mx-auto max-w-5xl space-y-5 pb-24">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold text-primary-dark">
            <Users className="h-6 w-6 text-primary" /> Agenda de Contactos
          </h1>
          <p className="text-sm text-muted-foreground">
            Clientes, proveedores y choferes en un solo lugar.
          </p>
        </div>
        {!readOnly && (
          <button
            onClick={() => setOpen(true)}
            className="inline-flex min-h-[44px] items-center gap-2 rounded-md bg-primary px-4 text-sm font-semibold text-primary-foreground shadow-sm hover:bg-primary-dark"
          >
            <Plus className="h-4 w-4" /> Agregar contacto
          </button>
        )}
      </header>

      {/* Filtros */}
      <section aria-label="Filtros" className="flex flex-wrap items-center gap-2 rounded-lg border bg-card p-3">
        <div className="flex flex-wrap items-center gap-1.5">
          <button
            onClick={() => setTipos([])}
            className={`rounded-full px-3 py-1.5 text-xs font-semibold ring-1 ${
              tipos.length === 0 ? "bg-primary text-primary-foreground ring-primary" : "bg-background text-muted-foreground ring-border"
            }`}
          >
            Todos
          </button>
          {TIPOS.map((t) => (
            <button
              key={t}
              onClick={() => toggleTipo(t)}
              aria-pressed={tipos.includes(t)}
              className={`rounded-full px-3 py-1.5 text-xs font-semibold ring-1 ${
                tipos.includes(t) ? "bg-primary text-primary-foreground ring-primary" : "bg-background text-muted-foreground ring-border"
              }`}
            >
              {TIPO_LABEL[t]}
            </button>
          ))}
        </div>

        <select
          value={temp}
          onChange={(e) => setTemp(e.target.value)}
          aria-label="Temperatura"
          className="min-h-[38px] rounded-md border bg-background px-2 text-sm"
        >
          <option value="">Todos</option>
          <option value="caliente">🔴 Caliente</option>
          <option value="tibio">🟡 Tibio</option>
          <option value="frio">🔵 Frío</option>
        </select>

        <div className="relative ml-auto min-w-[200px] flex-1">
          <Search className="pointer-events-none absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Buscar por nombre o empresa…"
            aria-label="Buscar contacto"
            className="min-h-[38px] w-full rounded-md border bg-background pl-8 pr-2 text-sm"
          />
        </div>
      </section>

      {listQuery.isLoading ? (
        <div className="space-y-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-24 animate-pulse rounded-lg border bg-muted/40" />
          ))}
        </div>
      ) : rows.length === 0 ? (
        <div className="rounded-lg border border-dashed p-10 text-center">
          <p className="text-sm font-medium text-muted-foreground">No se encontraron contactos</p>
          {hasFilters && (
            <button
              onClick={clearFilters}
              className="mt-3 inline-flex min-h-[40px] items-center rounded-md border px-4 text-sm font-semibold hover:bg-muted"
            >
              Limpiar filtros
            </button>
          )}
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {rows.map((c: any) => (
            <article key={c.id} className="rounded-lg border bg-card p-4 shadow-sm">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h2 className="flex items-center gap-2 text-base font-semibold text-foreground">
                    <span className={`h-2.5 w-2.5 rounded-full ${TEMP_DOT[c.temperatura] ?? "bg-muted"}`}
                      title={TEMP_LABEL[c.temperatura] ?? c.temperatura} aria-hidden />
                    {c.nombre}
                  </h2>
                  {c.empresa && <p className="text-sm text-muted-foreground">{c.empresa}</p>}
                </div>
                <div className="flex flex-wrap justify-end gap-1">
                  {(c.tipos ?? []).map((t: Tipo) => (
                    <span key={t} className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ${TIPO_CLASS[t] ?? "bg-muted text-muted-foreground ring-border"}`}>
                      {TIPO_LABEL[t] ?? t}
                    </span>
                  ))}
                </div>
              </div>
              <dl className="mt-2 space-y-0.5 text-sm">
                {c.email && <dd className="truncate text-muted-foreground">{c.email}</dd>}
                {c.telefono && <dd className="text-muted-foreground">{c.telefono}</dd>}
              </dl>
              {c.etapa_comercial && (
                <p className="mt-2 text-xs tracking-wide text-muted-foreground">{ETAPA_LABEL[c.etapa_comercial] ?? c.etapa_comercial}</p>
              )}
              <button
                onClick={() => toast.info("El detalle del contacto estará disponible pronto.")}
                className="mt-3 inline-flex min-h-[36px] items-center rounded-md border px-3 text-xs font-semibold hover:bg-muted"
              >
                Ver detalle
              </button>
            </article>
          ))}
        </div>
      )}

      {open && !readOnly && (
        <ContactoModal onClose={() => setOpen(false)} onSaved={() => { setOpen(false); listQuery.refetch(); }} />
      )}
    </div>
  );
}

const EMPTY = {
  nombre: "", empresa: "", rut: "", telefono: "", email: "", region: "",
  tipos: [] as Tipo[], temperatura: "frio", etapa_comercial: "lead", notas: "",
  banco: "", tipo_cuenta: "", numero_cuenta: "", email_banco: "",
};

function ContactoModal({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState({ ...EMPTY });
  const [bankOpen, setBankOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const create = useServerFn(createContacto);
  const set = (k: string, v: any) => setForm((f) => ({ ...f, [k]: v }));
  const regiones = useMemo(() => REGIONES_CHILE, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.nombre.trim()) { toast.error("El nombre es obligatorio"); return; }
    if (form.tipos.length === 0) { toast.error("Selecciona al menos un tipo"); return; }
    setSaving(true);
    try {
      await create({ data: form as any });
      toast.success("Contacto creado");
      onSaved();
    } catch (err: any) {
      toast.error(err?.message ?? "No se pudo crear el contacto");
    } finally {
      setSaving(false);
    }
  };

  const input = "min-h-[40px] w-full rounded-md border bg-background px-2 text-sm";

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/50 p-4">
      <form onSubmit={submit} className="w-full max-w-lg rounded-xl border bg-card p-5 shadow-xl">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-primary-dark">Nuevo contacto</h2>
          <button type="button" onClick={onClose} aria-label="Cerrar" className="rounded p-1 hover:bg-muted">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <label className="sm:col-span-2 text-sm">
            <span className="font-medium">Nombre *</span>
            <input required value={form.nombre} onChange={(e) => set("nombre", e.target.value)} className={input} maxLength={200} />
          </label>
          <label className="text-sm"><span className="font-medium">Empresa</span>
            <input value={form.empresa} onChange={(e) => set("empresa", e.target.value)} className={input} maxLength={200} />
          </label>
          <label className="text-sm"><span className="font-medium">RUT</span>
            <input value={form.rut} onChange={(e) => set("rut", e.target.value)} className={input} maxLength={30} />
          </label>
          <label className="text-sm"><span className="font-medium">Teléfono</span>
            <input value={form.telefono} onChange={(e) => set("telefono", e.target.value)} className={input} maxLength={40} />
          </label>
          <label className="text-sm"><span className="font-medium">Email</span>
            <input type="email" value={form.email} onChange={(e) => set("email", e.target.value)} className={input} maxLength={255} />
          </label>
          <label className="text-sm"><span className="font-medium">Región</span>
            <select value={form.region} onChange={(e) => set("region", e.target.value)} className={input}>
              <option value="">—</option>
              {regiones.map((r) => <option key={r} value={r}>{r}</option>)}
            </select>
          </label>
          <label className="text-sm"><span className="font-medium">Temperatura</span>
            <select value={form.temperatura} onChange={(e) => set("temperatura", e.target.value)} className={input}>
              <option value="frio">Frío</option>
              <option value="tibio">Tibio</option>
              <option value="caliente">Caliente</option>
            </select>
          </label>
          <fieldset className="sm:col-span-2">
            <legend className="text-sm font-medium">Tipos *</legend>
            <div className="mt-1 flex flex-wrap gap-3">
              {TIPOS.map((t) => (
                <label key={t} className="inline-flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={form.tipos.includes(t)}
                    onChange={(e) =>
                      set("tipos", e.target.checked ? [...form.tipos, t] : form.tipos.filter((x) => x !== t))
                    }
                  />
                  {TIPO_LABEL[t]}
                </label>
              ))}
            </div>
          </fieldset>
          <label className="sm:col-span-2 text-sm"><span className="font-medium">Etapa comercial</span>
            <select value={form.etapa_comercial} onChange={(e) => set("etapa_comercial", e.target.value)} className={input}>
              {ETAPAS.map((e2) => <option key={e2} value={e2}>{ETAPA_LABEL[e2]}</option>)}
            </select>
          </label>
          <label className="sm:col-span-2 text-sm"><span className="font-medium">Notas</span>
            <textarea value={form.notas} onChange={(e) => set("notas", e.target.value)} rows={3} maxLength={2000}
              className="w-full rounded-md border bg-background p-2 text-sm" />
          </label>
        </div>

        <div className="mt-4 rounded-md border">
          <button type="button" onClick={() => setBankOpen((v) => !v)}
            aria-expanded={bankOpen}
            className="flex w-full items-center justify-between px-3 py-2 text-sm font-semibold">
            Datos bancarios
            <ChevronDown className={`h-4 w-4 transition-transform ${bankOpen ? "rotate-180" : ""}`} />
          </button>
          {bankOpen && (
            <div className="grid gap-3 border-t p-3 sm:grid-cols-2">
              <label className="text-sm"><span className="font-medium">Banco</span>
                <input value={form.banco} onChange={(e) => set("banco", e.target.value)} className={input} maxLength={120} />
              </label>
              <label className="text-sm"><span className="font-medium">Tipo de cuenta</span>
                <select value={form.tipo_cuenta} onChange={(e) => set("tipo_cuenta", e.target.value)} className={input}>
                  <option value="">—</option>
                  <option value="cuenta_corriente">Cuenta corriente</option>
                  <option value="cuenta_vista">Cuenta vista</option>
                  <option value="cuenta_rut">Cuenta RUT</option>
                  <option value="cuenta_ahorro">Cuenta de ahorro</option>
                  <option value="otro">Otro</option>
                </select>
              </label>
              <label className="text-sm"><span className="font-medium">N° de cuenta</span>
                <input value={form.numero_cuenta} onChange={(e) => set("numero_cuenta", e.target.value)} className={input} maxLength={60} />
              </label>
              <label className="text-sm"><span className="font-medium">Email banco</span>
                <input type="email" value={form.email_banco} onChange={(e) => set("email_banco", e.target.value)} className={input} maxLength={255} />
              </label>
            </div>
          )}
        </div>

        <div className="mt-5 flex justify-end gap-2">
          <button type="button" onClick={onClose} className="min-h-[40px] rounded-md border px-4 text-sm font-semibold hover:bg-muted">
            Cancelar
          </button>
          <button type="submit" disabled={saving}
            className="min-h-[40px] rounded-md bg-primary px-4 text-sm font-semibold text-primary-foreground hover:bg-primary-dark disabled:opacity-60">
            {saving ? "Guardando…" : "Guardar contacto"}
          </button>
        </div>
      </form>
    </div>
  );
}
