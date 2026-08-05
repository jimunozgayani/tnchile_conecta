import { createFileRoute } from "@tanstack/react-router";
import { pageHead } from "@/lib/page-head";
import { requireCommercial } from "@/lib/require-admin";
import { Users } from "lucide-react";

export const Route = createFileRoute("/_app/comercial-contactos")({
  head: () =>
    pageHead(
      "/comercial-contactos",
      "Contactos · Comercial TN Chile",
      "Agenda unificada de clientes, proveedores y choferes del equipo comercial de TN Chile.",
    ),
  ssr: false,
  beforeLoad: requireCommercial,
  component: ComercialContactosPage,
});

function ComercialContactosPage() {
  return (
    <div className="mx-auto flex max-w-xl flex-col items-center py-20 text-center">
      <Users className="mb-4 h-10 w-10 text-primary" />
      <h1 className="text-2xl font-bold tracking-tight">Agenda de Contactos</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Clientes, proveedores y choferes en un solo lugar.
      </p>
      <p className="mt-6 rounded-md bg-muted px-4 py-2 text-xs font-medium text-muted-foreground">
        Próximamente
      </p>
    </div>
  );
}
