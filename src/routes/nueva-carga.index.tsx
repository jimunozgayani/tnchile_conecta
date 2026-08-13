import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { subirArchivoCargaPublica } from "@/lib/carga-publica.functions";

import { Logo } from "@/components/Logo";
import { pageHead } from "@/lib/page-head";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/nueva-carga/")({
  ssr: false,
  head: () =>
    pageHead(
      "/nueva-carga",
      "Inscribe tu carga · Transporte de carga en Chile con TN Chile",
      "Cuéntanos qué necesitas trasladar y te contactamos en menos de 24 horas hábiles con una propuesta de transporte. Sin registro, en 7 pasos desde tu celular.",
    ),
  component: NuevaCargaPage,
});

type TipoCamion = { id: string; nombre: string };
type Archivo = { url: string; type: "foto" | "documento"; name: string };

const TOTAL_STEPS = 7;
const MAX_FILES = 10;
const MAX_SIZE = 10 * 1024 * 1024;
const ACCEPTED = ["image/jpeg", "image/jpg", "image/png", "image/webp", "application/pdf"];

function NuevaCargaPage() {
  const navigate = useNavigate();
  const subirArchivo = useServerFn(subirArchivoCargaPublica);

  const [step, setStep] = useState(1);
  const [enviando, setEnviando] = useState(false);
  const [tipos, setTipos] = useState<TipoCamion[]>([]);

  // Step 1
  const [tipoCamionId, setTipoCamionId] = useState("");
  const [tipoCamionOtro, setTipoCamionOtro] = useState("");
  const [descripcion, setDescripcion] = useState("");
  const [pesoKg, setPesoKg] = useState("");
  // Step 2
  const [origen, setOrigen] = useState("");
  const [destino, setDestino] = useState("");
  // Step 3
  const [fechaTipo, setFechaTipo] = useState<"exacta" | "probable" | "sin_fecha">("sin_fecha");
  const [fechaExacta, setFechaExacta] = useState("");
  const [fechaProbable, setFechaProbable] = useState("");
  // Step 4
  const [largo, setLargo] = useState("");
  const [ancho, setAncho] = useState("");
  const [alto, setAlto] = useState("");
  const [requerimientos, setRequerimientos] = useState("");
  // Step 5
  const [archivos, setArchivos] = useState<Archivo[]>([]);
  const [subiendo, setSubiendo] = useState(false);
  const [dragging, setDragging] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  // Step 6
  const [nombre, setNombre] = useState("");
  const [empresa, setEmpresa] = useState("");
  const [rut, setRut] = useState("");
  const [telefono, setTelefono] = useState("");
  const [email, setEmail] = useState("");

  useEffect(() => {
    supabase
      .from("tipos_camion")
      .select("id, nombre")
      .eq("activo", true)
      .order("orden", { ascending: true })
      .then(({ data }) => setTipos((data as TipoCamion[]) ?? []));
  }, []);

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, [step]);

  const tipoNombre = useMemo(() => {
    if (tipoCamionId === "otro") return tipoCamionOtro || "Otro";
    return tipos.find((t) => t.id === tipoCamionId)?.nombre ?? "";
  }, [tipoCamionId, tipoCamionOtro, tipos]);

  const fechaResumen =
    fechaTipo === "exacta" ? fechaExacta || "Fecha exacta (sin definir)" : fechaTipo === "probable" ? fechaProbable || "Período aproximado" : "Sin fecha todavía";

  function puedeAvanzar() {
    if (step === 1) return !!tipoCamionId && (tipoCamionId !== "otro" || tipoCamionOtro.trim()) && descripcion.trim().length > 2;
    if (step === 2) return origen.trim() && destino.trim();
    if (step === 3) return fechaTipo !== "exacta" || !!fechaExacta;
    if (step === 6) return nombre.trim() && telefono.trim() && /\S+@\S+\.\S+/.test(email);
    return true;
  }

  async function handleFiles(list: FileList | null) {
    if (!list?.length) return;
    const files = Array.from(list);
    if (archivos.length + files.length > MAX_FILES) {
      toast.error(`Máximo ${MAX_FILES} archivos.`);
      return;
    }
    setSubiendo(true);
    const nuevos: Archivo[] = [];
    for (const file of files) {
      if (!ACCEPTED.includes(file.type)) {
        toast.error(`${file.name}: formato no permitido (jpg, png, webp o PDF).`);
        continue;
      }
      if (file.size > MAX_SIZE) {
        toast.error(`${file.name}: supera los 10MB.`);
        continue;
      }
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result).split(",")[1] ?? "");
        reader.onerror = () => reject(new Error("read"));
        reader.readAsDataURL(file);
      }).catch(() => "");
      if (!base64) {
        toast.error(`No se pudo leer ${file.name}.`);
        continue;
      }
      let path: string;
      try {
        const res = await subirArchivo({ data: { contentType: file.type, base64 } });
        path = res.path;
      } catch {
        toast.error(`No se pudo subir ${file.name}.`);
        continue;
      }
      nuevos.push({ url: path, type: file.type === "application/pdf" ? "documento" : "foto", name: file.name });

    }
    setArchivos((prev) => [...prev, ...nuevos]);
    setSubiendo(false);
    if (nuevos.length) toast.success(`${nuevos.length} archivo(s) cargado(s).`);
  }

  async function enviar() {
    setEnviando(true);
    const dims = [largo, ancho, alto].every((v) => !v)
      ? ""
      : `Dimensiones: ${largo || "-"}x${ancho || "-"}x${alto || "-"} m.`;
    const notas = [
      dims,
      requerimientos.trim() ? `Requerimientos: ${requerimientos.trim()}` : "",
      fechaTipo === "probable" && fechaProbable ? `Período estimado: ${fechaProbable}` : "",
      fechaTipo === "sin_fecha" ? "Sin fecha definida." : "",
    ]
      .filter(Boolean)
      .join(" ");

    const toCm = (v: string) => (v ? String(Number(v) * 100) : "");

    const { data, error } = await supabase.rpc("crear_solicitud_carga", {
      _payload: {
        nombre,
        empresa,
        rut,
        telefono,
        email,
        origen,
        destinos: [{ destino }],
        tipo_camion_id: tipoCamionId === "otro" ? "" : tipoCamionId,
        tipo_camion_otro: tipoCamionId === "otro" ? tipoCamionOtro : "",
        tipo_camion: tipoNombre,
        peso_kg: pesoKg,
        largo_cm: toCm(largo),
        ancho_cm: toCm(ancho),
        alto_cm: toCm(alto),
        fecha_despacho: fechaTipo === "exacta" ? fechaExacta : "",
        fotos: archivos,
        lineas_servicio: [{ descripcion, cantidad: 1, precio_neto_clp: null }],
        notas_admin: notas,
      },
    });

    setEnviando(false);
    if (error || !data) {
      toast.error("No pudimos enviar tu solicitud. Intenta nuevamente.");
      return;
    }
    navigate({ to: "/nueva-carga/gracias", search: { ref: data as string } });
  }

  return (
    <main className="min-h-screen bg-background">
      <header className="border-b bg-primary px-4 py-3 text-primary-foreground">
        <Logo variant="with-text" textClassName="text-primary-foreground" showTagline={false} />
      </header>

      <div className="mx-auto w-full max-w-xl px-4 py-6">
        <div className="mb-6">
          <div className="mb-2 flex items-center justify-between text-sm text-muted-foreground">
            <span>Paso {step} de {TOTAL_STEPS}</span>
            <span>{Math.round((step / TOTAL_STEPS) * 100)}%</span>
          </div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-muted" role="progressbar" aria-valuenow={step} aria-valuemin={1} aria-valuemax={TOTAL_STEPS}>
            <div className="h-full bg-primary transition-all" style={{ width: `${(step / TOTAL_STEPS) * 100}%` }} />
          </div>
        </div>

        {step === 1 && (
          <section className="space-y-4">
            <h1 className="text-2xl font-bold">¿Qué necesitas trasladar?</h1>
            <div className="space-y-2">
              <Label htmlFor="tipo">Tipo de carga</Label>
              <select
                id="tipo"
                value={tipoCamionId}
                onChange={(e) => setTipoCamionId(e.target.value)}
                className="h-12 w-full rounded-md border border-input bg-background px-3 text-base"
              >
                <option value="">Selecciona una opción…</option>
                {tipos.map((t) => (
                  <option key={t.id} value={t.id}>{t.nombre}</option>
                ))}
                <option value="otro">Otro (especificar)</option>
              </select>
              {tipoCamionId === "otro" && (
                <Input className="h-12" placeholder="Describe el tipo de camión o carga" value={tipoCamionOtro} onChange={(e) => setTipoCamionOtro(e.target.value)} />
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="desc">Descripción de la carga</Label>
              <Textarea id="desc" rows={4} value={descripcion} onChange={(e) => setDescripcion(e.target.value)} placeholder="Ej: 2 contenedores de 20 pies vacíos, retroexcavadora, pallets de vino…" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="peso">Peso estimado (kg) — opcional</Label>
              <Input id="peso" className="h-12" type="number" inputMode="numeric" value={pesoKg} onChange={(e) => setPesoKg(e.target.value)} placeholder="Ej: 24000" />
            </div>
          </section>
        )}

        {step === 2 && (
          <section className="space-y-4">
            <h1 className="text-2xl font-bold">¿Desde dónde hasta dónde?</h1>
            <div className="space-y-2">
              <Label htmlFor="origen">Origen</Label>
              <Input id="origen" className="h-12" value={origen} onChange={(e) => setOrigen(e.target.value)} placeholder="Ciudad o dirección de origen" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="destino">Destino</Label>
              <Input id="destino" className="h-12" value={destino} onChange={(e) => setDestino(e.target.value)} placeholder="Ciudad o dirección de destino" />
            </div>
          </section>
        )}

        {step === 3 && (
          <section className="space-y-4">
            <h1 className="text-2xl font-bold">¿Cuándo?</h1>
            <div className="flex flex-wrap gap-2">
              {([
                ["exacta", "Fecha exacta"],
                ["probable", "Semana o mes aproximado"],
                ["sin_fecha", "Sin fecha todavía"],
              ] as const).map(([val, label]) => (
                <button
                  key={val}
                  type="button"
                  onClick={() => setFechaTipo(val)}
                  className={`min-h-11 rounded-full border px-4 text-sm font-medium transition-colors ${
                    fechaTipo === val ? "border-primary bg-primary text-primary-foreground" : "border-input bg-background"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
            {fechaTipo === "exacta" && (
              <div className="space-y-2">
                <Label htmlFor="fecha">Fecha de carga</Label>
                <Input id="fecha" className="h-12" type="date" value={fechaExacta} onChange={(e) => setFechaExacta(e.target.value)} />
              </div>
            )}
            {fechaTipo === "probable" && (
              <div className="space-y-2">
                <Label htmlFor="fprob">Período estimado</Label>
                <Input id="fprob" className="h-12" value={fechaProbable} onChange={(e) => setFechaProbable(e.target.value)} placeholder="Ej: primera semana de agosto, fines de julio…" />
              </div>
            )}
          </section>
        )}

        {step === 4 && (
          <section className="space-y-4">
            <h1 className="text-2xl font-bold">Dimensiones y requerimientos</h1>
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-2">
                <Label htmlFor="largo">Largo (m)</Label>
                <Input id="largo" className="h-12" type="number" inputMode="decimal" value={largo} onChange={(e) => setLargo(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="ancho">Ancho (m)</Label>
                <Input id="ancho" className="h-12" type="number" inputMode="decimal" value={ancho} onChange={(e) => setAncho(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="alto">Alto (m)</Label>
                <Input id="alto" className="h-12" type="number" inputMode="decimal" value={alto} onChange={(e) => setAlto(e.target.value)} />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="req">Requerimientos especiales</Label>
              <Textarea id="req" rows={4} value={requerimientos} onChange={(e) => setRequerimientos(e.target.value)} placeholder="Ej: necesita grúa, sobredimensión, escolta, caminos de tierra, descarga incluida…" />
            </div>
          </section>
        )}

        {step === 5 && (
          <section className="space-y-4">
            <h1 className="text-2xl font-bold">Fotos y documentos</h1>
            <p className="text-sm text-muted-foreground">Opcional. Hasta {MAX_FILES} archivos (jpg, png, webp o PDF), máximo 10MB cada uno.</p>
            <div
              onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
              onDragLeave={() => setDragging(false)}
              onDrop={(e) => { e.preventDefault(); setDragging(false); handleFiles(e.dataTransfer.files); }}
              onClick={() => fileRef.current?.click()}
              className={`flex min-h-32 cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed p-6 text-center ${dragging ? "border-primary bg-primary/5" : "border-input"}`}
            >
              <p className="font-medium">Toca para tomar una foto o adjuntar archivos</p>
              <p className="text-sm text-muted-foreground">También puedes arrastrarlos aquí</p>
              <input
                ref={fileRef}
                type="file"
                multiple
                accept="image/jpeg,image/png,image/webp,application/pdf"
                capture="environment"
                className="hidden"
                onChange={(e) => handleFiles(e.target.files)}
              />
            </div>
            {subiendo && <p className="text-sm text-muted-foreground">Subiendo archivos…</p>}
            {archivos.length > 0 && (
              <ul className="grid grid-cols-3 gap-3">
                {archivos.map((a, i) => (
                  <li key={a.url} className="rounded-md border p-2 text-center">
                    <div className="mb-1 flex h-16 items-center justify-center rounded bg-muted text-xs">
                      {a.type === "foto" ? "🖼️" : "📄"}
                    </div>
                    <p className="truncate text-[11px]" title={a.name}>{a.name}</p>
                    <button type="button" className="text-[11px] text-destructive underline" onClick={() => setArchivos(archivos.filter((_, j) => j !== i))}>
                      Quitar
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>
        )}

        {step === 6 && (
          <section className="space-y-4">
            <h1 className="text-2xl font-bold">Tus datos</h1>
            <div className="space-y-2">
              <Label htmlFor="nombre">Nombre completo</Label>
              <Input id="nombre" className="h-12" value={nombre} onChange={(e) => setNombre(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="empresa">Empresa o razón social — opcional</Label>
              <Input id="empresa" className="h-12" value={empresa} onChange={(e) => setEmpresa(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="rut">RUT — opcional</Label>
              <Input id="rut" className="h-12" value={rut} onChange={(e) => setRut(e.target.value)} placeholder="76.543.210-K" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="tel">Teléfono</Label>
              <Input id="tel" className="h-12" type="tel" inputMode="tel" value={telefono} onChange={(e) => setTelefono(e.target.value)} placeholder="+56 9 1234 5678" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="mail">Email</Label>
              <Input id="mail" className="h-12" type="email" inputMode="email" value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
            <p className="text-xs text-muted-foreground">
              Solo usaremos tus datos para coordinar tu traslado. No compartimos tu información con terceros.
            </p>
          </section>
        )}

        {step === 7 && (
          <section className="space-y-4">
            <h1 className="text-2xl font-bold">Confirmación</h1>
            <dl className="space-y-2 rounded-lg border p-4 text-sm">
              <Row label="Tipo de carga" value={tipoNombre} />
              <Row label="Ruta" value={`${origen} → ${destino}`} />
              <Row label="Fecha" value={fechaResumen} />
              {pesoKg && <Row label="Peso" value={`${pesoKg} kg`} />}
              <Row label="Nombre" value={nombre} />
              {empresa && <Row label="Empresa" value={empresa} />}
              <Row label="Teléfono" value={telefono} />
              <Row label="Email" value={email} />
              {archivos.length > 0 && <Row label="Archivos" value={`${archivos.length} adjunto(s)`} />}
            </dl>
            <Button className="h-14 w-full text-base" disabled={enviando} onClick={enviar}>
              {enviando ? "Enviando…" : "Enviar solicitud"}
            </Button>
            <button type="button" className="block w-full text-center text-sm underline" onClick={() => setStep(6)}>
              ← Revisar mis respuestas
            </button>
          </section>
        )}

        {step < 7 && (
          <div className="mt-8 space-y-3">
            <Button className="h-14 w-full text-base" disabled={!puedeAvanzar() || subiendo} onClick={() => setStep((s) => s + 1)}>
              Siguiente →
            </Button>
            {step === 5 && (
              <button type="button" className="block w-full text-center text-sm underline" onClick={() => setStep(6)}>
                Omitir por ahora
              </button>
            )}
            {step > 1 && (
              <button type="button" className="block w-full text-center text-sm underline" onClick={() => setStep((s) => s - 1)}>
                ← Atrás
              </button>
            )}
          </div>
        )}
      </div>
    </main>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="text-right font-medium">{value}</dd>
    </div>
  );
}
