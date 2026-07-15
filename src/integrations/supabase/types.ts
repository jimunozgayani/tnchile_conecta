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
      asignaciones: {
        Row: {
          activa: boolean
          camion_id: string
          chofer_id: string
          created_at: string
          fecha_desde: string
          fecha_hasta: string | null
          id: string
          notas: string | null
          proveedor_id: string
          updated_at: string
        }
        Insert: {
          activa?: boolean
          camion_id: string
          chofer_id: string
          created_at?: string
          fecha_desde?: string
          fecha_hasta?: string | null
          id?: string
          notas?: string | null
          proveedor_id: string
          updated_at?: string
        }
        Update: {
          activa?: boolean
          camion_id?: string
          chofer_id?: string
          created_at?: string
          fecha_desde?: string
          fecha_hasta?: string | null
          id?: string
          notas?: string | null
          proveedor_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "asignaciones_camion_id_fkey"
            columns: ["camion_id"]
            isOneToOne: false
            referencedRelation: "trucks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "asignaciones_chofer_id_fkey"
            columns: ["chofer_id"]
            isOneToOne: false
            referencedRelation: "drivers"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_log: {
        Row: {
          accion: string
          created_at: string
          datos_anteriores: Json | null
          datos_nuevos: Json | null
          id: string
          registro_id: string | null
          tabla_nombre: string
          usuario_email: string | null
          usuario_id: string | null
        }
        Insert: {
          accion: string
          created_at?: string
          datos_anteriores?: Json | null
          datos_nuevos?: Json | null
          id?: string
          registro_id?: string | null
          tabla_nombre: string
          usuario_email?: string | null
          usuario_id?: string | null
        }
        Update: {
          accion?: string
          created_at?: string
          datos_anteriores?: Json | null
          datos_nuevos?: Json | null
          id?: string
          registro_id?: string | null
          tabla_nombre?: string
          usuario_email?: string | null
          usuario_id?: string | null
        }
        Relationships: []
      }
      disponibilidad_camion: {
        Row: {
          camion_id: string
          created_at: string
          destino: string | null
          estado: Database["public"]["Enums"]["disponibilidad_estado"]
          fecha: string
          id: string
          lugar: string | null
          tipo_carga: string | null
          updated_at: string
        }
        Insert: {
          camion_id: string
          created_at?: string
          destino?: string | null
          estado?: Database["public"]["Enums"]["disponibilidad_estado"]
          fecha: string
          id?: string
          lugar?: string | null
          tipo_carga?: string | null
          updated_at?: string
        }
        Update: {
          camion_id?: string
          created_at?: string
          destino?: string | null
          estado?: Database["public"]["Enums"]["disponibilidad_estado"]
          fecha?: string
          id?: string
          lugar?: string | null
          tipo_carga?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "disponibilidad_camion_camion_id_fkey"
            columns: ["camion_id"]
            isOneToOne: false
            referencedRelation: "trucks"
            referencedColumns: ["id"]
          },
        ]
      }
      documents: {
        Row: {
          created_at: string
          deleted_at: string | null
          file_url: string
          id: string
          is_current: boolean
          nombre: string | null
          previous_version_id: string | null
          related_id: string | null
          tipo: string
          user_id: string
          vencimiento: string | null
          version_number: number
        }
        Insert: {
          created_at?: string
          deleted_at?: string | null
          file_url: string
          id?: string
          is_current?: boolean
          nombre?: string | null
          previous_version_id?: string | null
          related_id?: string | null
          tipo: string
          user_id: string
          vencimiento?: string | null
          version_number?: number
        }
        Update: {
          created_at?: string
          deleted_at?: string | null
          file_url?: string
          id?: string
          is_current?: boolean
          nombre?: string | null
          previous_version_id?: string | null
          related_id?: string | null
          tipo?: string
          user_id?: string
          vencimiento?: string | null
          version_number?: number
        }
        Relationships: [
          {
            foreignKeyName: "documents_previous_version_id_fkey"
            columns: ["previous_version_id"]
            isOneToOne: false
            referencedRelation: "documents"
            referencedColumns: ["id"]
          },
        ]
      }
      driver_availability: {
        Row: {
          availability: Json
          created_at: string
          destination: string | null
          id: string
          load_status: string
          location: string | null
          name: string | null
          truck_type: string | null
          updated_at: string
        }
        Insert: {
          availability?: Json
          created_at?: string
          destination?: string | null
          id?: string
          load_status?: string
          location?: string | null
          name?: string | null
          truck_type?: string | null
          updated_at?: string
        }
        Update: {
          availability?: Json
          created_at?: string
          destination?: string | null
          id?: string
          load_status?: string
          location?: string | null
          name?: string | null
          truck_type?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      drivers: {
        Row: {
          carnet_vencimiento: string | null
          celular: string | null
          clase_licencia: string | null
          created_at: string
          deleted_at: string | null
          estado_doc: string | null
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
          deleted_at?: string | null
          estado_doc?: string | null
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
          deleted_at?: string | null
          estado_doc?: string | null
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
      login_attempts: {
        Row: {
          attempted_at: string
          id: string
          success: boolean
          user_email: string
        }
        Insert: {
          attempted_at?: string
          id?: string
          success?: boolean
          user_email: string
        }
        Update: {
          attempted_at?: string
          id?: string
          success?: boolean
          user_email?: string
        }
        Relationships: []
      }
      mensajes: {
        Row: {
          asunto: string
          contenido: string
          created_at: string
          de_usuario_id: string
          id: string
          leido: boolean
          para_proveedor_id: string
        }
        Insert: {
          asunto: string
          contenido: string
          created_at?: string
          de_usuario_id: string
          id?: string
          leido?: boolean
          para_proveedor_id: string
        }
        Update: {
          asunto?: string
          contenido?: string
          created_at?: string
          de_usuario_id?: string
          id?: string
          leido?: boolean
          para_proveedor_id?: string
        }
        Relationships: []
      }
      notificaciones: {
        Row: {
          created_at: string
          dias_restantes: number
          doc_tipo: string
          entity_id: string
          entity_name: string | null
          entity_tipo: string
          fecha_vencimiento: string
          id: string
          leida: boolean
          severidad: string
          umbral: number
          user_id: string
        }
        Insert: {
          created_at?: string
          dias_restantes: number
          doc_tipo: string
          entity_id: string
          entity_name?: string | null
          entity_tipo: string
          fecha_vencimiento: string
          id?: string
          leida?: boolean
          severidad: string
          umbral: number
          user_id: string
        }
        Update: {
          created_at?: string
          dias_restantes?: number
          doc_tipo?: string
          entity_id?: string
          entity_name?: string | null
          entity_tipo?: string
          fecha_vencimiento?: string
          id?: string
          leida?: boolean
          severidad?: string
          umbral?: number
          user_id?: string
        }
        Relationships: []
      }
      polizas: {
        Row: {
          activa: boolean
          archivo_url: string | null
          aseguradora: string | null
          created_at: string
          deleted_at: string | null
          fecha_inicio: string | null
          fecha_vencimiento: string | null
          id: string
          monto: number | null
          numero_poliza: string | null
          proveedor_id: string
          tipo_cobertura: string | null
          updated_at: string
        }
        Insert: {
          activa?: boolean
          archivo_url?: string | null
          aseguradora?: string | null
          created_at?: string
          deleted_at?: string | null
          fecha_inicio?: string | null
          fecha_vencimiento?: string | null
          id?: string
          monto?: number | null
          numero_poliza?: string | null
          proveedor_id: string
          tipo_cobertura?: string | null
          updated_at?: string
        }
        Update: {
          activa?: boolean
          archivo_url?: string | null
          aseguradora?: string | null
          created_at?: string
          deleted_at?: string | null
          fecha_inicio?: string | null
          fecha_vencimiento?: string | null
          id?: string
          monto?: number | null
          numero_poliza?: string | null
          proveedor_id?: string
          tipo_cobertura?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          cargo: string | null
          certificado_sii_url: string | null
          correo: string | null
          created_at: string
          deleted_at: string | null
          direccion: string | null
          estado_doc: string | null
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
          deleted_at?: string | null
          direccion?: string | null
          estado_doc?: string | null
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
          deleted_at?: string | null
          direccion?: string | null
          estado_doc?: string | null
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
          deleted_at: string | null
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
          deleted_at?: string | null
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
          deleted_at?: string | null
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
      supplier_invitations: {
        Row: {
          activated_at: string | null
          company_name: string | null
          created_at: string
          email: string
          id: string
          invited_at: string
          invited_by: string | null
          notes: string | null
          rut: string | null
          status: Database["public"]["Enums"]["invitation_status"]
          updated_at: string
          user_id: string | null
        }
        Insert: {
          activated_at?: string | null
          company_name?: string | null
          created_at?: string
          email: string
          id?: string
          invited_at?: string
          invited_by?: string | null
          notes?: string | null
          rut?: string | null
          status?: Database["public"]["Enums"]["invitation_status"]
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          activated_at?: string | null
          company_name?: string | null
          created_at?: string
          email?: string
          id?: string
          invited_at?: string
          invited_by?: string | null
          notes?: string | null
          rut?: string | null
          status?: Database["public"]["Enums"]["invitation_status"]
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
      }
      tarifas: {
        Row: {
          created_at: string
          id: string
          incluye_iva: boolean
          notas: string | null
          precio_base_clp: number | null
          precio_por_km_clp: number | null
          proveedor_id: string
          region_destino: string
          region_origen: string
          tipo_camion: string
          updated_at: string
          vigente_desde: string
        }
        Insert: {
          created_at?: string
          id?: string
          incluye_iva?: boolean
          notas?: string | null
          precio_base_clp?: number | null
          precio_por_km_clp?: number | null
          proveedor_id: string
          region_destino: string
          region_origen: string
          tipo_camion: string
          updated_at?: string
          vigente_desde?: string
        }
        Update: {
          created_at?: string
          id?: string
          incluye_iva?: boolean
          notas?: string | null
          precio_base_clp?: number | null
          precio_por_km_clp?: number | null
          proveedor_id?: string
          region_destino?: string
          region_origen?: string
          tipo_camion?: string
          updated_at?: string
          vigente_desde?: string
        }
        Relationships: []
      }
      trucks: {
        Row: {
          anio: number | null
          capacidad_toneladas: number | null
          created_at: string
          deleted_at: string | null
          estado_doc: string | null
          estado_operativo: string
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
          deleted_at?: string | null
          estado_doc?: string | null
          estado_operativo?: string
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
          deleted_at?: string | null
          estado_doc?: string | null
          estado_operativo?: string
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
      get_admin_dashboard_stats: {
        Args: never
        Returns: unknown
        SetofOptions: {
          from: "*"
          to: "admin_dashboard_stats"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_email_locked: { Args: { _email: string }; Returns: boolean }
      is_suspended: { Args: { _user_id: string }; Returns: boolean }
      process_document_expiries: { Args: never; Returns: undefined }
    }
    Enums: {
      app_role: "admin" | "supplier"
      disponibilidad_estado: "disponible" | "no_disponible" | "sin_confirmar"
      invitation_status: "invited" | "active" | "suspended"
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
      disponibilidad_estado: ["disponible", "no_disponible", "sin_confirmar"],
      invitation_status: ["invited", "active", "suspended"],
    },
  },
} as const
