import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const TIPOS = ["cliente", "proveedor", "chofer"] as const;

const contactoSchema = z.object({
  nombre: z.string().trim().min(1, "Nombre requerido").max(200),
  empresa: z.string().trim().max(200).optional().nullable(),
  rut: z.string().trim().max(30).optional().nullable(),
  telefono: z.string().trim().max(40).optional().nullable(),
  email: z.string().trim().max(255).optional().nullable(),
  region: z.string().trim().max(120).optional().nullable(),
  tipos: z.array(z.enum(TIPOS)).min(1, "Selecciona al menos un tipo"),
  temperatura: z.enum(["frio", "tibio", "caliente"]).default("frio"),
  etapa_comercial: z.enum(["lead", "contactado", "cotizado", "ganado", "perdido"]).default("lead"),
  notas: z.string().trim().max(2000).optional().nullable(),
  banco: z.string().trim().max(120).optional().nullable(),
  tipo_cuenta: z
    .enum(["cuenta_corriente", "cuenta_vista", "cuenta_rut", "cuenta_ahorro", "otro", ""])
    .optional()
    .nullable(),
  numero_cuenta: z.string().trim().max(60).optional().nullable(),
  email_banco: z.string().trim().max(255).optional().nullable(),
});

export type ContactoInput = z.infer<typeof contactoSchema>;

const clean = (v: unknown) => {
  const s = typeof v === "string" ? v.trim() : v;
  return s === "" || s === undefined ? null : s;
};

export const createContacto = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => contactoSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const { data: roleRows } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userId);
    const roles = (roleRows ?? []).map((r: { role: string }) => r.role);
    if (!["admin", "lider_cuenta", "comercial"].some((r) => roles.includes(r))) {
      throw new Error("No tienes permisos para crear contactos.");
    }

    const { data: row, error } = await supabase
      .from("contactos")
      .insert({
        nombre: data.nombre,
        empresa: clean(data.empresa),
        rut: clean(data.rut),
        telefono: clean(data.telefono),
        email: clean(data.email),
        region: clean(data.region),
        tipos: data.tipos,
        temperatura: data.temperatura,
        etapa_comercial: data.etapa_comercial,
        notas: clean(data.notas),
        banco: clean(data.banco),
        tipo_cuenta: clean(data.tipo_cuenta),
        numero_cuenta: clean(data.numero_cuenta),
        email_banco: clean(data.email_banco),
        origen_contacto: "otro",
        responsable_id: userId,
        deleted_at: null,
      } as never)
      .select("id")
      .single();

    if (error) throw new Error(error.message);
    return { id: (row as { id: string }).id };
  });
