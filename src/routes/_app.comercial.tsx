import { createFileRoute } from "@tanstack/react-router";
import { pageHead } from "@/lib/page-head";
import { requireCommercial } from "@/lib/require-admin";
import { Handshake } from "lucide-react";

export const Route = createFileRoute("/_app/comercial")({
  head: () =>
    pageHead(
      "/comercial",
      "Comercial · TN Chile",
      "Pipeline de cotizaciones y agenda de contactos del equipo comercial de TN Chile.",
    ),
  // La sesión de Supabase vive en localStorage: el gate corre solo en el cliente.
  ssr: false,
  beforeLoad: requireCommercial,
  component: ComercialPage,
});

function ComercialPage() {
  return (
    <div className="mx-auto flex max-w-xl flex-col items-center py-20 text-center">
      <Handshake className="mb-4 h-10 w-10 text-primary" />
      <h1 className="text-2xl font-bold tracking-tight">Espacio Comercial</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Pipeline de cotizaciones y agenda de contactos.
      </p>
      <p className="mt-6 rounded-md bg-muted px-4 py-2 text-xs font-medium text-muted-foreground">
        Próximamente
      </p>
    </div>
  );
}
