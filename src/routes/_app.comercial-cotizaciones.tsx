import { createFileRoute } from "@tanstack/react-router";
import { pageHead } from "@/lib/page-head";
import { requireCommercial } from "@/lib/require-admin";
import { FileText } from "lucide-react";

export const Route = createFileRoute("/_app/comercial-cotizaciones")({
  head: () =>
    pageHead(
      "/comercial-cotizaciones",
      "Cotizaciones · Comercial TN Chile",
      "Pipeline y seguimiento de cotizaciones por estado para el equipo comercial de TN Chile.",
    ),
  ssr: false,
  beforeLoad: requireCommercial,
  component: ComercialCotizacionesPage,
});

function ComercialCotizacionesPage() {
  return (
    <div className="mx-auto flex max-w-xl flex-col items-center py-20 text-center">
      <FileText className="mb-4 h-10 w-10 text-primary" />
      <h1 className="text-2xl font-bold tracking-tight">Pipeline de Cotizaciones</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Seguimiento de cotizaciones por estado.
      </p>
      <p className="mt-6 rounded-md bg-muted px-4 py-2 text-xs font-medium text-muted-foreground">
        Próximamente
      </p>
    </div>
  );
}
