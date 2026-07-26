import { createFileRoute, redirect } from "@tanstack/react-router";

/** Merged into the single availability space at /operaciones-disponibilidad. */
export const Route = createFileRoute("/_app/operaciones-disponibilidad-mapa")({
  beforeLoad: () => {
    throw redirect({ to: "/operaciones-disponibilidad" });
  },
});
