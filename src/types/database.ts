// Manually aligned with Ryan's prod schema (baspxigjzkrotqxmpygf) as of
// 2026-05-21. Re-run `supabase gen types typescript --linked` once CLI access
// to the prod project is available. Until then this file is the source of
// truth for table/column shapes the vendor app reads & writes.
//
// Phase 5 migration: vendors → vendor_profiles, jobs → vendor_requests,
// direct assigned_vendor_id FK → request_vendors (M2M), expo_push_token
// → device_tokens table, client fields (client_name/email/phone) → profiles
// join via client_id. job_messages.content → message, .job_id → request_id.

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
      vendor_profiles: {
        // service_area is a legacy compatibility column on Ryan's schema, kept
        // optional until business_name is fully rolled out. address as a
        // single text field is gone — use state/city/zipcode instead.
        Row: {
          about: string | null
          avatar_path: string | null
          business_name: string | null
          city: string | null
          coi_path: string | null
          created_at: string | null
          email: string | null
          id: string
          insured: boolean | null
          license_number: string | null
          name: string
          notification_prefs: Json | null
          phone: string | null
          radius_miles: number | null
          rating: number | null
          service_area: string | null
          service_categories: string[] | null
          state: string | null
          status: string | null
          stripe_account_id: string | null
          updated_at: string | null
          user_id: string | null
          w9_path: string | null
          zipcode: string | null
        }
        Insert: {
          about?: string | null
          avatar_path?: string | null
          business_name?: string | null
          city?: string | null
          coi_path?: string | null
          created_at?: string | null
          email?: string | null
          id?: string
          insured?: boolean | null
          license_number?: string | null
          name: string
          notification_prefs?: Json | null
          phone?: string | null
          radius_miles?: number | null
          rating?: number | null
          service_area?: string | null
          service_categories?: string[] | null
          state?: string | null
          status?: string | null
          stripe_account_id?: string | null
          updated_at?: string | null
          user_id?: string | null
          w9_path?: string | null
          zipcode?: string | null
        }
        Update: {
          about?: string | null
          avatar_path?: string | null
          business_name?: string | null
          city?: string | null
          coi_path?: string | null
          created_at?: string | null
          email?: string | null
          id?: string
          insured?: boolean | null
          license_number?: string | null
          name?: string
          notification_prefs?: Json | null
          phone?: string | null
          radius_miles?: number | null
          rating?: number | null
          service_area?: string | null
          service_categories?: string[] | null
          state?: string | null
          status?: string | null
          stripe_account_id?: string | null
          updated_at?: string | null
          user_id?: string | null
          w9_path?: string | null
          zipcode?: string | null
        }
        Relationships: []
      }
      vendor_requests: {
        Row: {
          admin_notes: string | null
          checkin_time: string | null
          checkout_time: string | null
          client_id: string | null
          completion_photo_ids: string[] | null
          created_at: string | null
          description: string | null
          eta_datetime: string | null
          eta_label: string | null
          id: string
          location: string | null
          priority: string | null
          service_type: string
          status: string
          stripe_payment_id: string | null
          zipcode: string | null
        }
        Insert: {
          admin_notes?: string | null
          checkin_time?: string | null
          checkout_time?: string | null
          client_id?: string | null
          completion_photo_ids?: string[] | null
          created_at?: string | null
          description?: string | null
          eta_datetime?: string | null
          eta_label?: string | null
          id?: string
          location?: string | null
          priority?: string | null
          service_type: string
          status?: string
          stripe_payment_id?: string | null
          zipcode?: string | null
        }
        Update: {
          admin_notes?: string | null
          checkin_time?: string | null
          checkout_time?: string | null
          client_id?: string | null
          completion_photo_ids?: string[] | null
          created_at?: string | null
          description?: string | null
          eta_datetime?: string | null
          eta_label?: string | null
          id?: string
          location?: string | null
          priority?: string | null
          service_type?: string
          status?: string
          stripe_payment_id?: string | null
          zipcode?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "vendor_requests_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      request_vendors: {
        // M2M join from vendor_requests to vendor_profiles. job_status is the
        // per-vendor state (pending|in_progress|on_the_way|arrived|working|
        // completed|cancelled) — distinct from vendor_requests.status which
        // is the overall request state.
        Row: {
          created_at: string | null
          id: string
          job_status: string | null
          request_id: string
          va_confirmed_job_acceptance: boolean | null
          va_confirmed_time: boolean | null
          va_notes: string | null
          vendor_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          job_status?: string | null
          request_id: string
          va_confirmed_job_acceptance?: boolean | null
          va_confirmed_time?: boolean | null
          va_notes?: string | null
          vendor_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          job_status?: string | null
          request_id?: string
          va_confirmed_job_acceptance?: boolean | null
          va_confirmed_time?: boolean | null
          va_notes?: string | null
          vendor_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "request_vendors_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: false
            referencedRelation: "vendor_requests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "request_vendors_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "vendor_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        // Client (homeowner / PM) auth profile. Vendor-side reads only — we
        // never write to this table from the vendor app.
        Row: {
          created_at: string | null
          email: string | null
          first_name: string | null
          id: string
          last_name: string | null
          phone: string | null
        }
        Insert: {
          created_at?: string | null
          email?: string | null
          first_name?: string | null
          id: string
          last_name?: string | null
          phone?: string | null
        }
        Update: {
          created_at?: string | null
          email?: string | null
          first_name?: string | null
          id?: string
          last_name?: string | null
          phone?: string | null
        }
        Relationships: []
      }
      device_tokens: {
        // Replaces vendors.expo_push_token. One row per (user_id, platform).
        // Upserts via onConflict 'user_id,platform'. user_id is auth.users.id.
        Row: {
          created_at: string | null
          id: string
          platform: string
          token: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          platform: string
          token: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          platform?: string
          token?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      job_messages: {
        // request_id is the new primary FK (uuid → vendor_requests.id).
        // job_id is a legacy bigint kept nullable on Ryan's schema for
        // backfill compatibility — DO NOT write to it; reads should prefer
        // request_id. content was renamed to message.
        Row: {
          created_at: string | null
          id: string
          job_id: number | null
          message: string
          request_id: string | null
          sender: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          job_id?: number | null
          message: string
          request_id?: string | null
          sender: string
        }
        Update: {
          created_at?: string | null
          id?: string
          job_id?: number | null
          message?: string
          request_id?: string | null
          sender?: string
        }
        Relationships: [
          {
            foreignKeyName: "job_messages_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: false
            referencedRelation: "vendor_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      invoices: {
        // The four *_at engagement timestamps (overdue_at, paid_at, sent_at,
        // viewed_at) were added in supabase/schema/add-invoice-extensions.sql.
        // valid_until was added in supabase/schema/add-quote-extensions.sql
        // (used when kind='quote'). job_id now references vendor_requests.id,
        // vendor_id references vendor_profiles.id (post Phase 5 rename).
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
          overdue_at: string | null
          paid_at: string | null
          parts: number | null
          sent_at: string | null
          status: string
          total: number | null
          updated_at: string | null
          valid_until: string | null
          vendor_id: string | null
          viewed_at: string | null
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
          overdue_at?: string | null
          paid_at?: string | null
          parts?: number | null
          sent_at?: string | null
          status?: string
          total?: number | null
          updated_at?: string | null
          valid_until?: string | null
          vendor_id?: string | null
          viewed_at?: string | null
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
          overdue_at?: string | null
          paid_at?: string | null
          parts?: number | null
          sent_at?: string | null
          status?: string
          total?: number | null
          updated_at?: string | null
          valid_until?: string | null
          vendor_id?: string | null
          viewed_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "invoices_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "vendor_requests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "vendor_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      invoice_items: {
        // Added in supabase/schema/add-invoice-extensions.sql alongside the
        // send_invoice RPC. Manual entry pending next gen-types run.
        Row: {
          amount: number
          created_at: string | null
          description: string
          id: string
          invoice_id: string
          sort_order: number
        }
        Insert: {
          amount: number
          created_at?: string | null
          description: string
          id?: string
          invoice_id: string
          sort_order?: number
        }
        Update: {
          amount?: number
          created_at?: string | null
          description?: string
          id?: string
          invoice_id?: string
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "invoice_items_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
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
            referencedRelation: "vendor_requests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "support_messages_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "vendor_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
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
            referencedRelation: "vendor_requests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dispatch_log_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "vendor_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      // Hand-maintained. Regen by running (requires linked Supabase project):
      //   supabase gen types typescript --linked > src/types/database.ts
      //
      // Phase 5B BLOCKED: the five job-transition RPCs below target the
      // legacy jobs.status enum. Ryan has acknowledged (2026-05-21, WhatsApp)
      // and will reissue them against request_vendors.job_status. Call sites
      // are stubbed with Alert.alert until reissue lands — see JobChatScreen.
      accept_job: {
        Args: { p_job_id: string }
        Returns: Database['public']['Tables']['vendor_requests']['Row'][]
      }
      reject_job: {
        Args: { p_job_id: string; p_reason?: string | null }
        Returns: Database['public']['Tables']['vendor_requests']['Row'][]
      }
      start_travel: {
        Args: { p_job_id: string }
        Returns: Database['public']['Tables']['vendor_requests']['Row'][]
      }
      mark_on_site: {
        Args: { p_job_id: string }
        Returns: Database['public']['Tables']['vendor_requests']['Row'][]
      }
      complete_job: {
        Args: { p_job_id: string; p_photo_ids: string[] }
        Returns: Database['public']['Tables']['vendor_requests']['Row'][]
      }
      send_invoice: {
        Args: { p_job_id: string; p_items: Json; p_notes?: string | null }
        Returns: Database['public']['Tables']['invoices']['Row'][]
      }
      send_quote: {
        Args: {
          p_job_id: string
          p_items: Json
          p_notes?: string | null
          p_expires_in_days?: number
        }
        Returns: Database['public']['Tables']['invoices']['Row'][]
      }
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
