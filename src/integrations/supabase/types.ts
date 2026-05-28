export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      documents: {
        Row: {
          created_at: string
          file_url: string
          id: string
          nombre: string | null
          related_id: string | null
          tipo: string
          user_id: string
          vencimiento: string | null
        }
        Insert: {
          created_at?: string
          file_url: string
          id?: string
          nombre?: string | null
          related_id?: string | null
          tipo: string
          user_id: string
          vencimiento?: string | null
        }
        Update: {
          created_at?: string
          file_url?: string
          id?: string
          nombre?: string | null
          related_id?: string | null
          tipo?: string
          user_id?: string
          vencimiento?: string | null
        }
        Relationships: []
      }
      drivers: {
        Row: {
          carnet_vencimiento: string | null
          celular: string | null
          clase_licencia: string | null
          created_at: string
          foto_url: string | null
          id: string
          licencia_vencimiento: string | null
          nombre_completo: string
          rut: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          carnet_vencimiento?: string | null
          celular?: string | null
          clase_licencia?: string | null
          created_at?: string
          foto_url?: string | null
          id?: string
          licencia_vencimiento?: string | null
          nombre_completo: string
          rut?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          carnet_vencimiento?: string | null
          celular?: string | null
          clase_licencia?: string | null
          created_at?: string
          foto_url?: string | null
          id?: string
          licencia_vencimiento?: string | null
          nombre_completo?: string
          rut?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          cargo: string | null
          certificado_sii_url: string | null
          correo: string | null
          created_at: string
          direccion: string | null
          id: string
          nombre_contacto: string | null
          poliza_seguro_url: string | null
          poliza_seguro_vencimiento: string | null
          razon_social: string | null
          region: string | null
          rut_empresa: string | null
          telefono: string | null
          updated_at: string
        }
        Insert: {
          cargo?: string | null
          certificado_sii_url?: string | null
          correo?: string | null
          created_at?: string
          direccion?: string | null
          id: string
          nombre_contacto?: string | null
          poliza_seguro_url?: string | null
          poliza_seguro_vencimiento?: string | null
          razon_social?: string | null
          region?: string | null
          rut_empresa?: string | null
          telefono?: string | null
          updated_at?: string
        }
        Update: {
          cargo?: string | null
          certificado_sii_url?: string | null
          correo?: string | null
          created_at?: string
          direccion?: string | null
          id?: string
          nombre_contacto?: string | null
          poliza_seguro_url?: string | null
          poliza_seguro_vencimiento?: string | null
          razon_social?: string | null
          region?: string | null
          rut_empresa?: string | null
          telefono?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      rates: {
        Row: {
          created_at: string
          destino: string
          id: string
          origen: string
          precio_base_clp: number | null
          precio_km_adicional: number | null
          tipo_camion: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          destino: string
          id?: string
          origen: string
          precio_base_clp?: number | null
          precio_km_adicional?: number | null
          tipo_camion?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          destino?: string
          id?: string
          origen?: string
          precio_base_clp?: number | null
          precio_km_adicional?: number | null
          tipo_camion?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      trucks: {
        Row: {
          anio: number | null
          capacidad_toneladas: number | null
          created_at: string
          id: string
          marca: string | null
          modelo: string | null
          numero_ejes: number | null
          patente: string
          permiso_circulacion_vencimiento: string | null
          revision_tecnica_vencimiento: string | null
          soap_vencimiento: string | null
          tipo: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          anio?: number | null
          capacidad_toneladas?: number | null
          created_at?: string
          id?: string
          marca?: string | null
          modelo?: string | null
          numero_ejes?: number | null
          patente: string
          permiso_circulacion_vencimiento?: string | null
          revision_tecnica_vencimiento?: string | null
          soap_vencimiento?: string | null
          tipo?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          anio?: number | null
          capacidad_toneladas?: number | null
          created_at?: string
          id?: string
          marca?: string | null
          modelo?: string | null
          numero_ejes?: number | null
          patente?: string
          permiso_circulacion_vencimiento?: string | null
          revision_tecnica_vencimiento?: string | null
          soap_vencimiento?: string | null
          tipo?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "supplier"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["admin", "supplier"],
    },
  },
} as const
