import { supabase } from "@/integrations/supabase/client";

export type AdminDashboardStats = {
  total_proveedores_activos: number;
  total_camiones: number;
  total_choferes: number;
  docs_por_vencer_30d: number;
  docs_vencidos: number;
  cumplimiento_promedio_porcentaje: number;
  proveedores_por_region: Record<string, number>;
  tipos_camion_conteo: Record<string, number>;
  refreshed_at: string;
};

export async function fetchAdminDashboardStats(): Promise<AdminDashboardStats | null> {
  const { data, error } = await (supabase as any).rpc("get_admin_dashboard_stats");
  if (error || !data) return null;
  return data as AdminDashboardStats;
}
