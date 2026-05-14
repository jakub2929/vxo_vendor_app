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
      dispatch_log: {
        Row: {
          action: string
          created_at: string | null
          id: string
          job_id: string | null
          vendor_id: string | null
        }
        Insert: {
          action: string
          created_at?: string | null
          id?: string
          job_id?: string | null
          vendor_id?: string | null
        }
        Update: {
          action?: string
          created_at?: string | null
          id?: string
          job_id?: string | null
          vendor_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "dispatch_log_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dispatch_log_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "vendors"
            referencedColumns: ["id"]
          },
        ]
      }
      invoices: {
        Row: {
          created_at: string | null
          description: string | null
          diagnostic_fee: number | null
          id: string
          job_id: string
          kind: string
          labor: number | null
          line_items: Json | null
          notes: string | null
          parts: number | null
          status: string
          total: number | null
          updated_at: string | null
          vendor_id: string | null
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          diagnostic_fee?: number | null
          id?: string
          job_id: string
          kind?: string
          labor?: number | null
          line_items?: Json | null
          notes?: string | null
          parts?: number | null
          status?: string
          total?: number | null
          updated_at?: string | null
          vendor_id?: string | null
        }
        Update: {
          created_at?: string | null
          description?: string | null
          diagnostic_fee?: number | null
          id?: string
          job_id?: string
          kind?: string
          labor?: number | null
          line_items?: Json | null
          notes?: string | null
          parts?: number | null
          status?: string
          total?: number | null
          updated_at?: string | null
          vendor_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "invoices_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "vendors"
            referencedColumns: ["id"]
          },
        ]
      }
      job_messages: {
        Row: {
          content: string
          created_at: string | null
          id: string
          job_id: string
          sender: string
        }
        Insert: {
          content: string
          created_at?: string | null
          id?: string
          job_id: string
          sender: string
        }
        Update: {
          content?: string
          created_at?: string | null
          id?: string
          job_id?: string
          sender?: string
        }
        Relationships: [
          {
            foreignKeyName: "job_messages_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
        ]
      }
      jobs: {
        Row: {
          address: string
          assigned_vendor_id: string | null
          checkin_time: string | null
          checkout_time: string | null
          client_email: string | null
          client_name: string | null
          completion_photo_ids: string[] | null
          created_at: string | null
          description: string | null
          dispatch_fee: number | null
          eta_datetime: string | null
          eta_label: string | null
          id: string
          location_lat: number | null
          location_lng: number | null
          pm_id: string | null
          status: string
          trade: string
          updated_at: string | null
          urgency: string | null
          zip_code: string | null
        }
        Insert: {
          address: string
          assigned_vendor_id?: string | null
          checkin_time?: string | null
          checkout_time?: string | null
          client_email?: string | null
          client_name?: string | null
          completion_photo_ids?: string[] | null
          created_at?: string | null
          description?: string | null
          dispatch_fee?: number | null
          eta_datetime?: string | null
          eta_label?: string | null
          id?: string
          location_lat?: number | null
          location_lng?: number | null
          pm_id?: string | null
          status?: string
          trade: string
          updated_at?: string | null
          urgency?: string | null
          zip_code?: string | null
        }
        Update: {
          address?: string
          assigned_vendor_id?: string | null
          checkin_time?: string | null
          checkout_time?: string | null
          client_email?: string | null
          client_name?: string | null
          completion_photo_ids?: string[] | null
          created_at?: string | null
          description?: string | null
          dispatch_fee?: number | null
          eta_datetime?: string | null
          eta_label?: string | null
          id?: string
          location_lat?: number | null
          location_lng?: number | null
          pm_id?: string | null
          status?: string
          trade?: string
          updated_at?: string | null
          urgency?: string | null
          zip_code?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "jobs_assigned_vendor_id_fkey"
            columns: ["assigned_vendor_id"]
            isOneToOne: false
            referencedRelation: "vendors"
            referencedColumns: ["id"]
          },
        ]
      }
      support_messages: {
        Row: {
          created_at: string
          id: string
          job_id: string | null
          message: string
          sender: string
          thread_type: string
          vendor_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          job_id?: string | null
          message: string
          sender: string
          thread_type: string
          vendor_id: string
        }
        Update: {
          created_at?: string
          id?: string
          job_id?: string | null
          message?: string
          sender?: string
          thread_type?: string
          vendor_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "support_messages_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "support_messages_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "vendors"
            referencedColumns: ["id"]
          },
        ]
      }
      vendors: {
        Row: {
          address: string | null
          avatar_path: string | null
          bio: string | null
          business: string | null
          coi_path: string | null
          created_at: string | null
          dispatch_fee: number | null
          email: string | null
          expo_push_token: string | null
          id: string
          insured: boolean | null
          name: string
          pay_preference: string | null
          phone: string | null
          radius_miles: number | null
          rating: number | null
          status: string | null
          stripe_account_id: string | null
          trades: Json | null
          updated_at: string | null
          w9_path: string | null
          zip_code: string | null
        }
        Insert: {
          address?: string | null
          avatar_path?: string | null
          bio?: string | null
          business?: string | null
          coi_path?: string | null
          created_at?: string | null
          dispatch_fee?: number | null
          email?: string | null
          expo_push_token?: string | null
          id?: string
          insured?: boolean | null
          name: string
          pay_preference?: string | null
          phone?: string | null
          radius_miles?: number | null
          rating?: number | null
          status?: string | null
          stripe_account_id?: string | null
          trades?: Json | null
          updated_at?: string | null
          w9_path?: string | null
          zip_code?: string | null
        }
        Update: {
          address?: string | null
          avatar_path?: string | null
          bio?: string | null
          business?: string | null
          coi_path?: string | null
          created_at?: string | null
          dispatch_fee?: number | null
          email?: string | null
          expo_push_token?: string | null
          id?: string
          insured?: boolean | null
          name?: string
          pay_preference?: string | null
          phone?: string | null
          radius_miles?: number | null
          rating?: number | null
          status?: string | null
          stripe_account_id?: string | null
          trades?: Json | null
          updated_at?: string | null
          w9_path?: string | null
          zip_code?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
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
    Enums: {},
  },
} as const
