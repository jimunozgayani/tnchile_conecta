import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { pageHead } from "@/lib/page-head";

export const Route = createFileRoute("/_app/mi-disponibilidad")({
  ssr: false,
  head: () =>
    pageHead(
      "/mi-disponibilidad",
      "Mi disponibilidad · Portal TN Chile",
      "Esta sección se movió: la disponibilidad ahora se gestiona por chofer en el portal TN Chile.",
    ),
  component: MiDisponibilidadRedirect,
});

/**
 * Legacy route. The old fleet-based availability screen is deprecated;
 * everything now lives in /mi-disponibilidad-chofer, which reads from
 * disponibilidad_chofer. Kept only as an immediate redirect so old links
 * and bookmarks never land on the removed page.
 */

function MiDisponibilidadRedirect() {
  const navigate = useNavigate();

  useEffect(() => {
    navigate({ to: "/mi-disponibilidad-chofer", replace: true });
  }, [navigate]);

  return (
    <div className="mx-auto max-w-xl p-6 text-sm text-muted-foreground">
      Redirigiendo a Mi disponibilidad…
    </div>
  );
}
