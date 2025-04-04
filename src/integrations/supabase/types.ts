export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  public: {
    Tables: {
      attendance: {
        Row: {
          assigned_class: string | null
          created_at: string
          date: string | null
          department: string | null
          department_id: string | null
          event_id: string | null
          id: string
          status: boolean
          student_id: string | null
          updated_at: string
        }
        Insert: {
          assigned_class?: string | null
          created_at?: string
          date?: string | null
          department?: string | null
          department_id?: string | null
          event_id?: string | null
          id?: string
          status?: boolean
          student_id?: string | null
          updated_at?: string
        }
        Update: {
          assigned_class?: string | null
          created_at?: string
          date?: string | null
          department?: string | null
          department_id?: string | null
          event_id?: string | null
          id?: string
          status?: boolean
          student_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "attendance_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      companies: {
        Row: {
          auto_save: boolean | null
          compact_view: boolean | null
          congregation_name: string | null
          created_at: string
          dark_mode: boolean | null
          id: number
          logo_url: string | null
          name: string
          notifications: boolean | null
          show_attendance_history: boolean | null
          show_name: boolean | null
          show_profile_images: boolean | null
          updated_at: string
        }
        Insert: {
          auto_save?: boolean | null
          compact_view?: boolean | null
          congregation_name?: string | null
          created_at?: string
          dark_mode?: boolean | null
          id?: number
          logo_url?: string | null
          name: string
          notifications?: boolean | null
          show_attendance_history?: boolean | null
          show_name?: boolean | null
          show_profile_images?: boolean | null
          updated_at?: string
        }
        Update: {
          auto_save?: boolean | null
          compact_view?: boolean | null
          congregation_name?: string | null
          created_at?: string
          dark_mode?: boolean | null
          id?: number
          logo_url?: string | null
          name?: string
          notifications?: boolean | null
          show_attendance_history?: boolean | null
          show_name?: boolean | null
          show_profile_images?: boolean | null
          updated_at?: string
        }
        Relationships: []
      }
      db_version: {
        Row: {
          applied_at: string | null
          environment: string
          id: number
          version: string
        }
        Insert: {
          applied_at?: string | null
          environment: string
          id?: number
          version: string
        }
        Update: {
          applied_at?: string | null
          environment?: string
          id?: number
          version?: string
        }
        Relationships: []
      }
      departments: {
        Row: {
          classes: string[] | null
          created_at: string
          description: string | null
          id: string
          name: string | null
          updated_at: string
        }
        Insert: {
          classes?: string[] | null
          created_at?: string
          description?: string | null
          id?: string
          name?: string | null
          updated_at?: string
        }
        Update: {
          classes?: string[] | null
          created_at?: string
          description?: string | null
          id?: string
          name?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      events: {
        Row: {
          created_at: string
          date: string
          description: string | null
          id: string
          time: string | null
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          date: string
          description?: string | null
          id?: string
          time?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          date?: string
          description?: string | null
          id?: string
          time?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          assigned_class: string | null
          department_id: string | null
          departments: string[] | null
          first_name: string | null
          id: string
          last_name: string | null
          role: Database["public"]["Enums"]["app_role"]
        }
        Insert: {
          assigned_class?: string | null
          department_id?: string | null
          departments?: string[] | null
          first_name?: string | null
          id?: string
          last_name?: string | null
          role?: Database["public"]["Enums"]["app_role"]
        }
        Update: {
          assigned_class?: string | null
          department_id?: string | null
          departments?: string[] | null
          first_name?: string | null
          id?: string
          last_name?: string | null
          role?: Database["public"]["Enums"]["app_role"]
        }
        Relationships: [
          {
            foreignKeyName: "profiles_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
        ]
      }
      students: {
        Row: {
          address: string | null
          assigned_class: string | null
          birthdate: string | null
          created_at: string
          department: string | null
          department_id: string | null
          document_number: string | null
          gender: string
          id: string
          name: string
          phone: string | null
          updated_at: string
        }
        Insert: {
          address?: string | null
          assigned_class?: string | null
          birthdate?: string | null
          created_at?: string
          department?: string | null
          department_id?: string | null
          document_number?: string | null
          gender?: string
          id?: string
          name: string
          phone?: string | null
          updated_at?: string
        }
        Update: {
          address?: string | null
          assigned_class?: string | null
          birthdate?: string | null
          created_at?: string
          department?: string | null
          department_id?: string | null
          document_number?: string | null
          gender?: string
          id?: string
          name?: string
          phone?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "students_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      get_environment: {
        Args: Record<PropertyKey, never>
        Returns: string
      }
      update_department_ids: {
        Args: Record<PropertyKey, never>
        Returns: undefined
      }
    }
    Enums: {
      app_role: "admin" | "lider" | "director" | "maestro" | "secretaria"
      department_type:
        | "escuelita_central"
        | "pre_adolescentes"
        | "adolescentes"
        | "jovenes"
        | "jovenes_adultos"
        | "adultos"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type PublicSchema = Database[Extract<keyof Database, "public">]

export type Tables<
  PublicTableNameOrOptions extends
    | keyof (PublicSchema["Tables"] & PublicSchema["Views"])
    | { schema: keyof Database },
  TableName extends PublicTableNameOrOptions extends { schema: keyof Database }
    ? keyof (Database[PublicTableNameOrOptions["schema"]]["Tables"] &
        Database[PublicTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = PublicTableNameOrOptions extends { schema: keyof Database }
  ? (Database[PublicTableNameOrOptions["schema"]]["Tables"] &
      Database[PublicTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : PublicTableNameOrOptions extends keyof (PublicSchema["Tables"] &
        PublicSchema["Views"])
    ? (PublicSchema["Tables"] &
        PublicSchema["Views"])[PublicTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  PublicTableNameOrOptions extends
    | keyof PublicSchema["Tables"]
    | { schema: keyof Database },
  TableName extends PublicTableNameOrOptions extends { schema: keyof Database }
    ? keyof Database[PublicTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = PublicTableNameOrOptions extends { schema: keyof Database }
  ? Database[PublicTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : PublicTableNameOrOptions extends keyof PublicSchema["Tables"]
    ? PublicSchema["Tables"][PublicTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  PublicTableNameOrOptions extends
    | keyof PublicSchema["Tables"]
    | { schema: keyof Database },
  TableName extends PublicTableNameOrOptions extends { schema: keyof Database }
    ? keyof Database[PublicTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = PublicTableNameOrOptions extends { schema: keyof Database }
  ? Database[PublicTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : PublicTableNameOrOptions extends keyof PublicSchema["Tables"]
    ? PublicSchema["Tables"][PublicTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  PublicEnumNameOrOptions extends
    | keyof PublicSchema["Enums"]
    | { schema: keyof Database },
  EnumName extends PublicEnumNameOrOptions extends { schema: keyof Database }
    ? keyof Database[PublicEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = PublicEnumNameOrOptions extends { schema: keyof Database }
  ? Database[PublicEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : PublicEnumNameOrOptions extends keyof PublicSchema["Enums"]
    ? PublicSchema["Enums"][PublicEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof PublicSchema["CompositeTypes"]
    | { schema: keyof Database },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends { schema: keyof Database }
  ? Database[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof PublicSchema["CompositeTypes"]
    ? PublicSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never
