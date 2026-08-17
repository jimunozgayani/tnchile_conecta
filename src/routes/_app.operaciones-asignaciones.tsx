import { createFileRoute, redirect } from "@tanstack/react-router";

/**
 * Ruta obsoleta: "Cargas por asignar" vive ahora en la ficha de operación
 * y el listado en /operaciones-lista. Se mantiene solo como redirección
 * para marcadores antiguos.
 */
export const Route = createFileRoute("/_app/operaciones-asignaciones")({
  ssr: false,
  beforeLoad: () => {
    throw redirect({ to: "/operaciones-lista" });
  },
  component: () => null,
});
