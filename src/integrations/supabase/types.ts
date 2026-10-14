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
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      app_settings: {
        Row: {
          key: string
          value: string
        }
        Insert: {
          key: string
          value: string
        }
        Update: {
          key?: string
          value?: string
        }
        Relationships: []
      }
      event_organisers: {
        Row: {
          added_at: string
          added_by: string | null
          event_id: string
          user_id: string
        }
        Insert: {
          added_at?: string
          added_by?: string | null
          event_id: string
          user_id: string
        }
        Update: {
          added_at?: string
          added_by?: string | null
          event_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "event_organisers_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      events: {
        Row: {
          capacity: number
          category: Database["public"]["Enums"]["event_category"]
          club_name: string
          confirmed_count: number
          contact_info: string | null
          cover_image_url: string | null
          created_at: string
          created_by: string | null
          description: string
          end_time: string
          event_date: string
          id: string
          is_sample: boolean
          registration_deadline: string | null
          short_description: string | null
          start_time: string
          status: Database["public"]["Enums"]["event_status"]
          title: string
          updated_at: string
          venue: string
        }
        Insert: {
          capacity: number
          category: Database["public"]["Enums"]["event_category"]
          club_name: string
          confirmed_count?: number
          contact_info?: string | null
          cover_image_url?: string | null
          created_at?: string
          created_by?: string | null
          description: string
          end_time: string
          event_date: string
          id?: string
          is_sample?: boolean
          registration_deadline?: string | null
          short_description?: string | null
          start_time: string
          status?: Database["public"]["Enums"]["event_status"]
          title: string
          updated_at?: string
          venue: string
        }
        Update: {
          capacity?: number
          category?: Database["public"]["Enums"]["event_category"]
          club_name?: string
          confirmed_count?: number
          contact_info?: string | null
          cover_image_url?: string | null
          created_at?: string
          created_by?: string | null
          description?: string
          end_time?: string
          event_date?: string
          id?: string
          is_sample?: boolean
          registration_deadline?: string | null
          short_description?: string | null
          start_time?: string
          status?: Database["public"]["Enums"]["event_status"]
          title?: string
          updated_at?: string
          venue?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          full_name: string | null
          id: string
        }
        Insert: {
          created_at?: string
          full_name?: string | null
          id: string
        }
        Update: {
          created_at?: string
          full_name?: string | null
          id?: string
        }
        Relationships: []
      }
      registrations: {
        Row: {
          checked_in_at: string | null
          checked_in_by: string | null
          code: string
          department: string
          event_id: string
          id: string
          prn: string
          registered_at: string
          registration_token: string | null
          status: Database["public"]["Enums"]["registration_status"]
          student_name: string
          token_hash: string
          user_id: string | null
        }
        Insert: {
          checked_in_at?: string | null
          checked_in_by?: string | null
          code?: string
          department: string
          event_id: string
          id?: string
          prn: string
          registered_at?: string
          registration_token?: string | null
          status?: Database["public"]["Enums"]["registration_status"]
          student_name: string
          token_hash: string
          user_id?: string | null
        }
        Update: {
          checked_in_at?: string | null
          checked_in_by?: string | null
          code?: string
          department?: string
          event_id?: string
          id?: string
          prn?: string
          registered_at?: string
          registration_token?: string | null
          status?: Database["public"]["Enums"]["registration_status"]
          student_name?: string
          token_hash?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "registrations_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
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
      add_event_staff: { Args: { _email: string; _event_id: string }; Returns: string }
      can_manage_event: { Args: { _event_id: string }; Returns: boolean }
      list_event_staff: {
        Args: { _event_id: string }
        Returns: {
          email: string
          full_name: string | null
          is_creator: boolean
          user_id: string
        }[]
      }
      my_managed_event_ids: { Args: never; Returns: string[] }
      my_organiser_stats: {
        Args: never
        Returns: {
          cancelled: number
          checked_in: number
          completed: number
          events_created: number
          events_managed: number
          past_unclosed: number
          registrations: number
          upcoming: number
        }[]
      }
      remove_event_staff: { Args: { _event_id: string; _user_id: string }; Returns: undefined }
      update_my_profile: { Args: { _full_name: string }; Returns: string }
      bootstrap_organiser: { Args: { _email: string }; Returns: string }
      check_in_pass: {
        Args: { _token: string }
        Returns: {
          checked_in_at: string | null
          registration_code: string | null
          result: string
          student_name: string | null
        }[]
      }
      event_attendance_counts: {
        Args: never
        Returns: {
          checked_in: number
          event_id: string
        }[]
      }
      get_pass: {
        Args: { _token: string }
        Returns: {
          checked_in_at: string | null
          club_name: string
          department: string
          end_time: string
          event_date: string
          event_id: string
          event_status: Database["public"]["Enums"]["event_status"]
          event_title: string
          registration_code: string
          start_time: string
          status: Database["public"]["Enums"]["registration_status"]
          student_name: string
          venue: string
        }[]
      }
      grant_organiser: { Args: { _email: string }; Returns: string }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      list_organisers: {
        Args: never
        Returns: {
          email: string
          full_name: string | null
          user_id: string
        }[]
      }
      mask_name: { Args: { _n: string }; Returns: string }
      pass_token_hash: { Args: { _token: string }; Returns: string }
      register_for_event: {
        Args: {
          _department: string
          _event_id: string
          _name: string
          _prn: string
        }
        Returns: {
          registration_code: string
          token: string
        }[]
      }
      registration_department_breakdown: {
        Args: never
        Returns: {
          department: string
          registrations: number
        }[]
      }
      revoke_organiser: { Args: { _user_id: string }; Returns: undefined }
      verify_pass: {
        Args: { _token: string }
        Returns: {
          checked_in_at: string | null
          department: string | null
          end_time: string | null
          event_date: string | null
          event_title: string | null
          is_organiser: boolean
          is_staff: boolean
          registration_code: string | null
          result: string
          start_time: string | null
          student_name: string | null
          venue: string | null
        }[]
      }
    }
    Enums: {
      app_role: "organiser"
      event_category: "Technical" | "Cultural" | "Sports" | "Workshop"
      event_status: "published" | "cancelled" | "completed"
      registration_status: "confirmed" | "cancelled"
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
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
      app_role: ["organiser"],
      event_category: ["Technical", "Cultural", "Sports", "Workshop"],
      event_status: ["published", "cancelled", "completed"],
      registration_status: ["confirmed", "cancelled"],
    },
  },
} as const
