import { createClient } from "@supabase/supabase-js";
const sb = createClient(process.env["SUPABASE_URL"]!, process.env["SUPABASE_SERVICE_ROLE_KEY"]!, {
  auth: { persistSession: false },
});
const { data } = await sb
  .from("operaciones")
  .select("id, numero_operacion, cotizacion_id, chofer_id, chofer_nombre_libre, patente_principal, patente_secundaria, fecha_carga, carga_hora_desde, carga_hora_hasta, descarga_fecha, descarga_notas, updated_at")
  .is("deleted_at", null)
  .order("numero_operacion", { ascending: false })
  .limit(5);
console.log(JSON.stringify(data, null, 1));
