import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { supabase } from "@/integrations/supabase/client";
import { diasHasta } from "@/lib/regions";
import { calcCompleteness } from "@/lib/completeness";

const GREEN = "#2D7A45";

function fmtDate(d: string | null | undefined): string {
  if (!d) return "—";
  try { return new Date(d).toLocaleDateString("es-CL"); } catch { return "—"; }
}
function fmtDT(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
function fmtCLP(n: number | null | undefined): string {
  if (n == null) return "—";
  return "$ " + new Intl.NumberFormat("es-CL").format(n);
}
function estadoFromDate(d: string | null | undefined): string {
  const days = diasHasta(d ?? null);
  if (days == null) return "Sin dato";
  if (days < 0) return "Vencido";
  if (days <= 30) return "Por vencer";
  return "Vigente";
}
function slugify(s: string): string {
  return s.normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "_").replace(/^_|_$/g, "").toLowerCase() || "proveedor";
}

export async function exportFichaProveedorPDF(proveedorId: string): Promise<void> {
  const [{ data: profile }, { data: trucks }, { data: drivers }, { data: docs }, { data: tarifas }] = await Promise.all([
    supabase.from("profiles").select("*").eq("id", proveedorId).maybeSingle(),
    supabase.from("trucks").select("*").eq("user_id", proveedorId).is("deleted_at", null),
    supabase.from("drivers").select("*").eq("user_id", proveedorId).is("deleted_at", null),
    supabase.from("documents").select("*").eq("user_id", proveedorId).is("deleted_at", null).eq("is_current", true),
    supabase.from("tarifas").select("*").eq("proveedor_id", proveedorId)
      .order("precio_base_clp", { ascending: true, nullsFirst: false }).limit(5),
  ]);

  if (!profile) throw new Error("Proveedor no encontrado");

  const camiones = trucks ?? [];
  const choferes = drivers ?? [];
  const polizas = (docs ?? []).filter((d) => /poliza|póliza/i.test(d.tipo || ""));
  const topTarifas = tarifas ?? [];

  const completion = calcCompleteness({
    profile, trucks: camiones, drivers: choferes,
  } as any);

  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 40;
  const now = new Date();
  const headerTitle = `Ficha de Proveedor · ${fmtDT(now)}`;

  // Header (drawn on every page via didDrawPage)
  const drawHeader = () => {
    doc.setFillColor(GREEN);
    doc.rect(0, 0, pageW, 36, "F");
    doc.setTextColor("#FFFFFF");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(13);
    doc.text("TN Chile", margin, 23);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.text(headerTitle, pageW - margin, 23, { align: "right" });
    doc.setTextColor("#000000");
  };

  const drawFooter = (pageNum: number, pageCount: number) => {
    doc.setFontSize(8);
    doc.setTextColor("#666666");
    doc.text(
      `TN Chile · Documento generado automáticamente · Confidencial · Página ${pageNum} de ${pageCount}`,
      pageW / 2, pageH - 18, { align: "center" }
    );
    doc.setTextColor("#000000");
  };

  drawHeader();
  let y = 60;

  // SECTION 1 — Datos
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.setTextColor(GREEN);
  doc.text("1. Datos del proveedor", margin, y);
  doc.setTextColor("#000000");
  y += 8;

  const datos: [string, string][] = [
    ["Razón social", profile.razon_social || "—"],
    ["RUT", profile.rut_empresa || "—"],
    ["Contacto", profile.nombre_contacto || "—"],
    ["Cargo", profile.cargo || "—"],
    ["Correo", profile.correo || "—"],
    ["Teléfono", profile.telefono || "—"],
    ["Región", profile.region || "—"],
    ["Fecha incorporación", fmtDate(profile.created_at)],
    ["Estado documental", (profile.estado_doc || "—").toString()],
    ["% Cumplimiento", `${completion}%`],
  ];
  autoTable(doc, {
    startY: y + 4,
    body: datos,
    theme: "grid",
    styles: { fontSize: 9, cellPadding: 4 },
    columnStyles: { 0: { fontStyle: "bold", fillColor: [240, 246, 240], cellWidth: 140 } },
    margin: { left: margin, right: margin },
    didDrawPage: drawHeader,
  });
  y = (doc as any).lastAutoTable.finalY + 18;

  const section = (title: string) => {
    if (y > pageH - 120) { doc.addPage(); y = 60; }
    doc.setFont("helvetica", "bold"); doc.setFontSize(13); doc.setTextColor(GREEN);
    doc.text(title, margin, y); doc.setTextColor("#000000"); y += 6;
  };

  // SECTION 2 — Flota
  section("2. Flota");
  autoTable(doc, {
    startY: y + 4,
    head: [["Patente", "Marca/Modelo", "Año", "Tipo", "SOAP vence", "Permiso vence", "Rev. técnica", "Estado"]],
    body: camiones.length ? camiones.map((t) => [
      t.patente || "—",
      [t.marca, t.modelo].filter(Boolean).join(" ") || "—",
      t.anio ?? "—",
      t.tipo || "—",
      fmtDate(t.soap_vencimiento),
      fmtDate(t.permiso_circulacion_vencimiento),
      fmtDate(t.revision_tecnica_vencimiento),
      (t.estado_doc || estadoFromDate(t.soap_vencimiento)),
    ]) : [["—", "—", "—", "—", "—", "—", "—", "Sin camiones"]],
    theme: "striped",
    headStyles: { fillColor: [45, 122, 69], textColor: 255, fontSize: 9 },
    styles: { fontSize: 8, cellPadding: 3 },
    margin: { left: margin, right: margin },
    didDrawPage: drawHeader,
  });
  y = (doc as any).lastAutoTable.finalY + 18;

  // SECTION 3 — Choferes
  section("3. Choferes");
  autoTable(doc, {
    startY: y + 4,
    head: [["Nombre", "RUT", "Clase", "Vence licencia", "Vence carnet", "Estado"]],
    body: choferes.length ? choferes.map((c) => [
      c.nombre_completo || "—",
      c.rut || "—",
      c.clase_licencia || "—",
      fmtDate(c.licencia_vencimiento),
      fmtDate(c.carnet_vencimiento),
      c.estado_doc || estadoFromDate(c.licencia_vencimiento),
    ]) : [["—", "—", "—", "—", "—", "Sin choferes"]],
    theme: "striped",
    headStyles: { fillColor: [45, 122, 69], textColor: 255, fontSize: 9 },
    styles: { fontSize: 8, cellPadding: 3 },
    margin: { left: margin, right: margin },
    didDrawPage: drawHeader,
  });
  y = (doc as any).lastAutoTable.finalY + 18;

  // SECTION 4 — Pólizas
  section("4. Pólizas");
  const polizaRows: any[] = polizas.map((p) => [
    p.nombre || p.id.slice(0, 8),
    "—", // Aseguradora
    p.tipo || "—",
    "—", // Monto
    fmtDate(p.created_at),
    fmtDate(p.vencimiento),
    estadoFromDate(p.vencimiento),
  ]);
  if (profile.poliza_seguro_url || profile.poliza_seguro_vencimiento) {
    polizaRows.push([
      "Póliza de seguro",
      "—",
      "Seguro general",
      "—",
      "—",
      fmtDate(profile.poliza_seguro_vencimiento),
      estadoFromDate(profile.poliza_seguro_vencimiento),
    ]);
  }
  autoTable(doc, {
    startY: y + 4,
    head: [["N° Póliza", "Aseguradora", "Tipo", "Monto", "Desde", "Hasta", "Estado"]],
    body: polizaRows.length ? polizaRows : [["—", "—", "—", "—", "—", "—", "Sin pólizas"]],
    theme: "striped",
    headStyles: { fillColor: [45, 122, 69], textColor: 255, fontSize: 9 },
    styles: { fontSize: 8, cellPadding: 3 },
    margin: { left: margin, right: margin },
    didDrawPage: drawHeader,
  });
  y = (doc as any).lastAutoTable.finalY + 18;

  // SECTION 5 — Tarifas top 5
  section("5. Tarifas — Top 5 rutas por precio");
  autoTable(doc, {
    startY: y + 4,
    head: [["Origen", "Destino", "Tipo camión", "Precio base", "Precio/km", "IVA"]],
    body: topTarifas.length ? topTarifas.map((t) => [
      t.region_origen, t.region_destino, t.tipo_camion,
      fmtCLP(t.precio_base_clp), fmtCLP(t.precio_por_km_clp),
      t.incluye_iva ? "Sí" : "No",
    ]) : [["—", "—", "—", "—", "—", "Sin tarifas"]],
    theme: "striped",
    headStyles: { fillColor: [45, 122, 69], textColor: 255, fontSize: 9 },
    styles: { fontSize: 8, cellPadding: 3 },
    margin: { left: margin, right: margin },
    didDrawPage: drawHeader,
  });

  // Footer on every page
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    drawFooter(i, pageCount);
  }

  const dateStr = new Date().toISOString().slice(0, 10);
  const filename = `ficha_${slugify(profile.razon_social || profile.correo || "proveedor")}_${dateStr}.pdf`;
  doc.save(filename);
}
