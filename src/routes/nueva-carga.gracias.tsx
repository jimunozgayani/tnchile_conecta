import { createFileRoute, Link } from "@tanstack/react-router";
import { Logo } from "@/components/Logo";
import { pageHead } from "@/lib/page-head";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/nueva-carga/gracias")({
  ssr: false,
  validateSearch: (search: Record<string, unknown>) => ({
    ref: typeof search.ref === "string" ? search.ref : "",
  }),
  head: () =>
    pageHead(
      "/nueva-carga/gracias",
      "Solicitud recibida · TN Chile te contacta en 24 horas",
      "Recibimos tu solicitud de transporte. Nuestro equipo de operaciones TN Chile te contactará en menos de 24 horas hábiles para coordinar tu carga.",
    ),
  component: GraciasPage,
});

function GraciasPage() {
  const { ref } = Route.useSearch();
  const corto = ref ? ref.replace(/-/g, "").slice(-6).toUpperCase() : "——————";

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-background px-4 py-12">
      <div className="w-full max-w-md space-y-6 text-center">
        <div className="flex justify-center">
          <Logo variant="full" className="h-20 w-auto" />
        </div>
        <h1 className="text-3xl font-bold text-primary">¡Gracias por tu solicitud!</h1>
        <p className="text-base text-muted-foreground">
          Tu número de solicitud es <span className="font-mono font-bold text-foreground">#{corto}</span>. Nuestro equipo te
          contactará en menos de 24 horas hábiles al teléfono o email que nos dejaste.
        </p>
        <Button asChild className="h-14 w-full text-base">
          <a href="https://wa.me/56971240415" target="_blank" rel="noopener noreferrer">
            Hablar con un ejecutivo por WhatsApp
          </a>
        </Button>
        <Link to="/nueva-carga" className="block text-sm underline">
          ¿Tienes otra carga? Ingresa otra solicitud
        </Link>
      </div>
    </main>
  );
}
