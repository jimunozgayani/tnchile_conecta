import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { obtenerProgreso, type ProgresoMap } from "./progreso-operaciones.server";

/**
 * Devuelve, por id de cotización, el estado de la operación ligada y el
 * estado del viaje del chofer — para alimentar los badges de progreso en
 * vivo del tablero comercial. Sólo se invoca desde el pipeline cotizaciones.
 */
export const obtenerProgresoOperaciones = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ ids: z.array(z.string()) }).parse(d))
  .handler(async ({ data }): Promise<ProgresoMap> => {
    return obtenerProgreso(data.ids);
  });
